import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import {
  CloudSun, Loader2, Shirt, X,
  MessageSquare, Settings, Send, MapPin,
  Wind, Droplets, Sun, CloudRain,
  Thermometer, LayoutGrid, ChevronDown, ChevronUp,
  Sparkles
} from 'lucide-react';

// --- 配置与环境获取优化 ---
const getEnv = (key) => {
  try {
    // 优先从 Vite 环境变量读取 (适用于 Vercel/本地开发)
    const viteVar = import.meta.env[`VITE_${key}`];
    if (viteVar) return viteVar;

    // 兼容 Canvas 模拟环境
    if (typeof window !== 'undefined' && window[key]) return window[key];
    return typeof __app_id !== 'undefined' ? (key === '__app_id' ? __app_id : (key === '__firebase_config' ? __firebase_config : (key === '__initial_auth_token' ? __initial_auth_token : ""))) : "";
  } catch (e) { return ""; }
};

// 动态获取 Gemini API Key
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

const IconMap = { Sun, CloudSun, CloudRain, MapPin };

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('general');
  const [wardrobe, setWardrobe] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);

  const [weather, setWeather] = useState({
    temp: '--', feelsLike: '--', condition: '定位中...',
    city: '自动定位', humidity: '--', wind: '--',
    icon: 'CloudSun', status: 'loading', theme: 'default'
  });

  const [messages, setMessages] = useState([
    { role: 'ai', text: '你好，我是 AURA。我已经准备好在 Vercel 环境下为你服务了。' }
  ]);

  const scrollRef = useRef(null);

  // Gemini API 调用
  const callGemini = async (prompt, retryCount = 0) => {
    if (!apiKey) return "系统配置错误：未检测到 Gemini API Key。请在 Vercel 环境变量中配置 VITE_GEMINI_API_KEY。";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const systemPrompt = `你是一位专业的时尚穿搭助手 AURA。
    当前天气：${weather.city} ${weather.condition}, ${weather.temp}°C。
    请根据天气给用户提供优雅的穿搭建议。`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 思考了一下，但没有说话。";
    } catch (error) {
      if (retryCount < 5) {
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
        return callGemini(prompt, retryCount + 1);
      }
      return "连接失败，请检查网络或 API 配置。";
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = getEnv('__initial_auth_token');
        if (token) await signInWithCustomToken(auth, token);
        else await signInAnonymously(auth);
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
          const data = await res.json();
          const codes = { 0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴天', 61: '小雨', 95: '雷阵雨' };
          const code = data.current.weather_code;
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            feelsLike: Math.round(data.current.apparent_temperature),
            condition: codes[code] || '多云',
            city: '我的位置',
            humidity: data.current.relative_humidity_2m,
            wind: data.current.wind_speed_10m,
            icon: code === 0 ? 'Sun' : 'CloudSun',
            status: 'success',
            theme: code === 0 ? 'sunny' : 'default'
          });
        } catch (e) { setWeather(prev => ({ ...prev, status: 'error' })); }
      });
    };
    fetchWeather();
  }, []);

  useEffect(() => {
    if (!user) return;
    const itemsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'items');
    return onSnapshot(itemsCol, (snap) => {
      setWardrobe(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Firestore Error:", err));
  }, [user]);

  const handleSend = async () => {
    if (!inputMsg.trim() || isAiTyping) return;
    const userText = inputMsg;
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsAiTyping(true);
    const aiResponse = await callGemini(userText);
    setIsAiTyping(false);
    setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[70%] bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
      </div>

      <header className="relative z-20 px-6 pt-8 pb-4 flex justify-between items-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-black tracking-tighter italic uppercase">AURA</h1>
        <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
          <Settings size={20} className="text-slate-300" />
        </button>
      </header>

      <main className="relative z-10 px-6 pb-40 max-w-2xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div onClick={() => setShowWeatherDetails(!showWeatherDetails)} className="bg-white/5 p-5 rounded-[2rem] border border-white/5 cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                <CloudSun size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">{weather.city}</p>
                <p className="text-xl font-black">{weather.temp}°C {weather.condition}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-fuchsia-500/20 text-fuchsia-400 rounded-2xl"><Shirt size={24} /></div>
            <p className="text-xl font-black">{wardrobe.length} <span className="text-sm font-normal text-slate-400">Items</span></p>
          </div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col h-[55vh]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto mb-6 pr-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${m.role === 'ai' ? 'bg-white/5 text-slate-200' : 'bg-indigo-600 text-white'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="寻求穿搭建议..."
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-6 pr-16 text-sm outline-none"
            />
            <button onClick={handleSend} className="absolute right-2 top-2 p-3 bg-indigo-500 rounded-xl"><Send size={18} /></button>
          </div>
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-[#0a0a0a] w-full max-w-md border border-white/10 rounded-[3rem] p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black uppercase">System Environment</h3>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs font-mono space-y-2">
              <p>Gemini Key: <span className={apiKey ? "text-green-400" : "text-red-400"}>{apiKey ? "已配置 (Active)" : "未检测到 (Missing)"}</span></p>
              <p>Firebase ID: <span className="text-indigo-400">{appId}</span></p>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-4 bg-white/5 rounded-2xl font-bold uppercase text-xs tracking-widest">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}