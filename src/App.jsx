import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, limit } from 'firebase/firestore';
import {
  CloudSun, Shirt, MessageSquare, Send,
  BrainCircuit, Zap, User, Plus, Sparkles, Loader2,
  Navigation, Ruler, Wind, Mic, Volume2, StopCircle
} from 'lucide-react';

// --- 环境与配置获取 ---
const getEnv = (key) => {
  try {
    const viteVar = import.meta.env[`VITE_${key}`];
    if (viteVar) return viteVar;
    if (typeof window !== 'undefined' && window[key]) return window[key];
    return typeof __app_id !== 'undefined' ? (key === '__app_id' ? __app_id : (key === '__firebase_config' ? __firebase_config : (key === '__initial_auth_token' ? __initial_auth_token : ""))) : "";
  } catch (e) { return ""; }
};

const apiKey = getEnv('GEMINI_API_KEY');
const firebaseConfigStr = getEnv('__firebase_config');
const firebaseConfig = firebaseConfigStr ? JSON.parse(firebaseConfigStr) : {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID')
};
const appId = getEnv('__app_id') || firebaseConfig.projectId || 'aura-ai-closet';

// 初始化 Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// --- Utilities for Audio ---
const pcmToWav = (pcmData, sampleRate) => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

// --- Text To Speech Service ---
const playVoice = async (text) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
        },
        model: "gemini-2.5-flash-preview-tts"
      })
    });

    if (!response.ok) throw new Error('TTS Network response was not ok');

    const result = await response.json();
    const base64Data = result.candidates[0].content.parts[0].inlineData.data;
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = (binaryString.charCodeAt(i+1) << 8) | binaryString.charCodeAt(i);
    }
    const wavBlob = pcmToWav(bytes, 24000);
    const audioUrl = URL.createObjectURL(wavBlob);
    const audio = new Audio(audioUrl);

    // Web Audio Policy: Play often needs user interaction or a clean promise handling
    await audio.play();
  } catch (e) {
    console.error("TTS Error:", e);
  }
};

// --- Weather Agent Hook ---
const useIntegratedWeather = () => {
  const [data, setData] = useState({ temp: 22, condition: '加载中...', report: 'Weather Agent 正在同步...', loading: true });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`);
        const json = await res.json();
        const codes = { 0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴天', 61: '小雨', 95: '雷阵雨' };
        const cond = codes[json.current.weather_code] || '多云';
        const temp = Math.round(json.current.temperature_2m);
        setData({
          temp,
          condition: cond,
          loading: false,
          report: `[Weather Agent]: 坐标(${latitude.toFixed(2)}), 气温${temp}度, 天气${cond}。`
        });
      } catch (e) {
        setData(prev => ({ ...prev, loading: false, report: '无法获取实时天气。' }));
      }
    });
  }, []);
  return data;
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [inputMsg, setInputMsg] = useState('');
  const [wardrobe, setWardrobe] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'AURA 系统已就绪。我是你的中央大脑，已连接天气顾问与衣橱助手。您可以发送文字，或点击麦克风开启语音。' }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputMsgRef = useRef('');

  const weatherAgent = useIntegratedWeather();

  useEffect(() => {
    inputMsgRef.current = inputMsg;
  }, [inputMsg]);

  // Speech Recognition Initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // 改为单次，更符合手机操作逻辑
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setInputMsg(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // 自动发送机制
        if (inputMsgRef.current.trim()) {
          const finalMsg = inputMsgRef.current;
          setInputMsg('');
          handleSend(finalMsg);
        }
      };

      recognitionRef.current.onerror = (e) => {
        console.error("Speech Error", e);
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = getEnv('__initial_auth_token');
      if (token) await signInWithCustomToken(auth, token);
      else await signInAnonymously(auth);
    };
    init();

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'wardrobe');
        return onSnapshot(q, (snap) => {
          setWardrobe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.error("Firestore Error:", err));
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isAiTyping]);

  const askAura = async (userInput) => {
    setIsAiTyping(true);
    const systemInstruction = `你是一个多智能体调度大脑 AURA。
    当前状态：${weatherAgent.report}
    衣橱：${wardrobe.length} 件单品。
    请简洁、专业地回复。`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userInput }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我的思考被中断了。";
    } catch (e) {
      return "通讯异常，请检查网络。";
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSend = async (overrideText) => {
    const text = typeof overrideText === 'string' ? overrideText : inputMsg;
    if (!text.trim() || isAiTyping) return;

    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', text }]);

    const aiRes = await askAura(text);
    setMessages(prev => [...prev, { role: 'ai', text: aiRes }]);
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInputMsg('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Header - Fixed Height */}
      <header className="px-6 py-4 flex justify-between items-center max-w-2xl mx-auto w-full border-b border-white/5 flex-shrink-0 z-50 bg-[#020617]/80 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h1 className="text-md font-black italic tracking-tighter uppercase">Aura Core</h1>
            <p className="text-[7px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Agent OS</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/10">
            <div className={`w-1 h-1 rounded-full ${weatherAgent.loading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[8px] font-bold text-slate-400">WEATHER</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl mx-auto w-full flex flex-col min-h-0 relative overflow-hidden px-4">
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full py-4 relative">
            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 gap-2 mb-4 flex-shrink-0">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 text-indigo-400 mb-0.5">
                        <CloudSun size={12} />
                        <span className="text-[8px] font-black uppercase">Climate</span>
                    </div>
                    <p className="text-xs font-bold">{weatherAgent.temp}°C · {weatherAgent.condition}</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 text-indigo-400 mb-0.5">
                        <Shirt size={12} />
                        <span className="text-[8px] font-black uppercase">Closet</span>
                    </div>
                    <p className="text-xs font-bold">{wardrobe.length} Items</p>
                </div>
            </div>

            {/* Messages - Scrollable with clear bottom padding for inputs */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar scroll-smooth pb-44"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'ai' ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[88%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'ai' ? 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none' : 'bg-indigo-600 text-white shadow-lg rounded-tr-none'
                  }`}>
                    {m.text}
                    {m.role === 'ai' && (
                      <button
                        onClick={() => playVoice(m.text)}
                        className="mt-3 flex items-center gap-2 text-[9px] font-bold text-indigo-400 uppercase tracking-tighter bg-white/10 px-3 py-1.5 rounded-full active:scale-95 transition-all"
                      >
                        <Volume2 size={12} /> 点击朗读
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-full w-fit animate-pulse border border-indigo-500/20">
                    <Zap size={10} className="text-indigo-400" />
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">AURA IS THINKING...</span>
                </div>
              )}
            </div>

            {/* Input Floating Dock - Higher Z-index and safe position */}
            <div className="absolute bottom-[90px] left-0 right-0 z-40 px-2">
              <div className="flex gap-2 max-w-2xl mx-auto items-end">
                <div className="relative flex-1">
                  <textarea
                    rows="1"
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    placeholder={isListening ? "正在倾听..." : "输入指令..."}
                    className={`w-full bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 shadow-2xl resize-none max-h-32 ${isListening ? 'ring-2 ring-indigo-500' : ''}`}
                  />
                  <button
                    onClick={() => handleSend()}
                    className="absolute right-2.5 bottom-2 p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-500 active:scale-90 transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <button
                  onClick={toggleVoiceInput}
                  className={`p-4 rounded-2xl border transition-all active:scale-90 flex-shrink-0 ${isListening ? 'bg-red-500 border-red-400' : 'bg-white/5 border-white/10 text-indigo-400'}`}
                >
                  {isListening ? <StopCircle size={22} className="animate-pulse" /> : <Mic size={22} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wardrobe' && (
          <div className="h-full py-6 pb-40 space-y-4 overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-black italic tracking-tighter uppercase">Wardrobe Vault</h2>
                <button className="p-3 bg-white/5 border border-white/10 rounded-xl"><Plus size={18}/></button>
             </div>
             <div className="grid grid-cols-2 gap-3">
                {wardrobe.map(item => (
                   <div key={item.id} className="aspect-[4/5] bg-white/5 rounded-2xl border border-white/10 overflow-hidden relative group">
                      {item.imageUrl && <img src={item.imageUrl} className="w-full h-full object-cover opacity-80" alt={item.name} />}
                      <div className="absolute bottom-3 left-3 right-3">
                         <p className="text-[9px] font-bold uppercase bg-black/60 backdrop-blur-md px-2 py-1 rounded w-fit">{item.name}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* Global Navigation Tab Bar - Fixed Bottom */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-6 z-[100]">
        <div className="bg-slate-900/95 backdrop-blur-3xl border border-white/10 p-1.5 rounded-full flex justify-around shadow-2xl shadow-indigo-500/10">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3.5 flex flex-col items-center rounded-full transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => setActiveTab('wardrobe')}
            className={`flex-1 py-3.5 flex flex-col items-center rounded-full transition-all ${activeTab === 'wardrobe' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shirt size={18} />
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3.5 flex flex-col items-center rounded-full transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User size={18} />
          </button>
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        /* 避免手机端键盘弹出导致的布局破坏 */
        @media (max-height: 500px) {
          nav { display: none; }
          .pb-44 { padding-bottom: 100px; }
        }
      `}} />
    </div>
  );
}