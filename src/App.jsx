import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, limit } from 'firebase/firestore';
import {
  CloudSun, Loader2, Shirt, X,
  MessageSquare, Settings, Send, MapPin,
  Wind, Droplets, Sun, CloudRain,
  Thermometer, LayoutGrid, ChevronDown, ChevronUp,
  Sparkles, User, Plus, Search, Filter
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

// --- 逻辑组件：Weather Agent (原本在 Hook 中，现在整合进来) ---
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
          report: `[Weather Agent]: 坐标(${latitude.toFixed(2)}), 气温${temp}度, 天气${cond}。湿度${json.current.relative_humidity_2m}%。建议根据${temp < 15 ? '寒冷' : '舒适'}天气穿衣。`
        });
      } catch (e) {
        setData(prev => ({ ...prev, loading: false, report: '无法获取实时天气。' }));
      }
    });
  }, []);
  return data;
};

// --- 主应用组件 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [inputMsg, setInputMsg] = useState('');
  const [wardrobe, setWardrobe] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'AURA 系统已就绪。我是你的中央大脑，已连接天气顾问与衣橱助手。' }
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const scrollRef = useRef(null);

  // 实例化天气 Agent
  const weatherAgent = useIntegratedWeather();

  // 1. 初始化 Auth 与 Firestore 监听 (衣橱 Agent)
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
        // 按照指定路径获取衣橱数据
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'wardrobe');
        return onSnapshot(q, (snap) => {
          setWardrobe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.error("Firestore Error:", err));
      }
    });
    return () => unsubAuth();
  }, []);

  // 滚动到底部
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // 2. 中央大脑编排逻辑 (The Orchestrator)
  const askAura = async (userInput) => {
    setIsAiTyping(true);

    const wardrobeReport = `[Wardrobe Agent 汇报]: 用户的衣橱里有 ${wardrobe.length} 件单品。列表: ${wardrobe.map(i => i.name).join(', ') || '暂无数据'}。`;

    const systemInstruction = `你是一个多智能体调度大脑 AURA。
    当前 Agent 状态：
    1. ${weatherAgent.report}
    2. ${wardrobeReport}

    任务规则：
    - 用户询问地点/天气：引用 Weather Agent。
    - 用户询问衣服/库存：引用 Wardrobe Agent。
    - 用户询问穿搭建议：综合两份简报，根据气温推荐衣橱里的单品。
    回复要优雅、时尚、像一位懂生活的私人助理。`;

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
      return "Agent 通讯异常，请检查网络。";
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || isAiTyping) return;
    const text = inputMsg;
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    const aiRes = await askAura(text);
    setMessages(prev => [...prev, { role: 'ai', text: aiRes }]);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-indigo-500/30">
      {/* 顶部状态栏 */}
      <header className="px-6 py-6 flex justify-between items-center max-w-2xl mx-auto w-full border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter">AURA CORE</h1>
            <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-[0.2em] text-left">Integrated Agent OS</p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${weatherAgent.loading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[9px] font-bold text-slate-400">WX-01</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[9px] font-bold text-slate-400">WD-02</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-28 max-w-2xl mx-auto w-full flex flex-col min-h-0">
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full py-4">
            {/* 智能体看板 */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <CloudSun size={14} />
                        <span className="text-[10px] font-black uppercase">Climate</span>
                    </div>
                    <p className="text-sm font-bold">{weatherAgent.temp}°C · {weatherAgent.condition}</p>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <Shirt size={14} />
                        <span className="text-[10px] font-black uppercase">Closet</span>
                    </div>
                    <p className="text-sm font-bold">{wardrobe.length} Items Sync'd</p>
                </div>
            </div>

            {/* 对话窗口 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[90%] p-4 rounded-3xl text-sm leading-relaxed ${
                    m.role === 'ai' ? 'bg-white/5 text-slate-300 border border-white/10' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full w-fit animate-pulse border border-indigo-500/20">
                    <Zap size={10} className="text-indigo-400" />
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Orchestrating Agents...</span>
                </div>
              )}
            </div>

            {/* 输入组件 */}
            <div className="relative mt-auto">
              <input
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="询问 AURA 关于穿搭、天气或衣橱..."
                className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 px-8 text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
              />
              <button onClick={handleSend} className="absolute right-3 top-3 p-4 bg-indigo-600 rounded-2xl hover:bg-indigo-500 transition-all active:scale-95">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'wardrobe' && (
          <div className="py-6 space-y-4 overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-end mb-4">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase">Vault</h2>
                <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"><Plus size={20}/></button>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {wardrobe.map(item => (
                   <div key={item.id} className="aspect-[3/4] bg-white/5 rounded-3xl border border-white/10 overflow-hidden relative group">
                      {item.imageUrl && <img src={item.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={item.name} />}
                      <div className="absolute bottom-4 left-4 right-4">
                         <p className="text-[10px] font-black uppercase bg-black/40 backdrop-blur-md px-2 py-1 rounded w-fit">{item.name}</p>
                      </div>
                   </div>
                ))}
                {wardrobe.length === 0 && (
                  <div className="col-span-2 py-20 text-center text-slate-500 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                    No items in vault
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-2 rounded-full flex justify-between shadow-2xl">
          <button onClick={() => setActiveTab('chat')} className={`flex-1 py-4 flex flex-col items-center rounded-full transition-all ${activeTab === 'chat' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/40' : 'text-slate-500 hover:text-slate-300'}`}>
            <MessageSquare size={20} />
          </button>
          <button onClick={() => setActiveTab('wardrobe')} className={`flex-1 py-4 flex flex-col items-center rounded-full transition-all ${activeTab === 'wardrobe' ? 'bg-indigo-600' : 'text-slate-500 hover:text-slate-300'}`}>
            <Shirt size={20} />
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex-1 py-4 flex flex-col items-center rounded-full transition-all ${activeTab === 'profile' ? 'bg-indigo-600' : 'text-slate-500 hover:text-slate-300'}`}>
            <User size={20} />
          </button>
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
      `}} />
    </div>
  );
}
