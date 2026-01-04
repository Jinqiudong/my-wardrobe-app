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

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'wardrobe', 'profile'
  const [wardrobe, setWardrobe] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [weather, setWeather] = useState({
    temp: '--', condition: '定位中...', city: '自动定位',
    humidity: '--', wind: '--', icon: 'CloudSun', theme: 'default'
  });

  const [messages, setMessages] = useState([
    { role: 'ai', text: '你好，我是 AURA。作为你的私人 AI 穿搭顾问，我已准备好为你分析今日穿搭。' }
  ]);

  const scrollRef = useRef(null);

  // --- Gemini API 调用逻辑 ---
  const callGemini = async (prompt, retryCount = 0) => {
    if (!apiKey) return "系统未检测到 Gemini API Key，请在环境变量中配置 VITE_GEMINI_API_KEY。";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // 构建强大的上下文大脑：位置 + 天气 + 衣橱状态
    const systemInstruction = `你是一位极具品味的 AI 时尚顾问 AURA。
    当前环境上下文：
    - 地点: ${weather.city}
    - 天气状况: ${weather.condition}
    - 实时气温: ${weather.temp}°C
    - 衣橱状态: 用户目前在数字衣橱中存储了 ${wardrobe.length} 件单品。
    你的任务：根据环境和用户的需求（如约会、上班、运动），提供富有审美的穿搭建议。回复应简洁、优雅，像一位懂时尚的朋友。`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我的大脑暂时断开了连接。";
    } catch (error) {
      if (retryCount < 5) {
        await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
        return callGemini(prompt, retryCount + 1);
      }
      return "连接超时。请检查网络设置。";
    }
  };

  // 初始化鉴权
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

  // 自动获取天气与位置
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
        const data = await res.json();
        const codes = { 0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴天', 61: '小雨', 95: '雷阵雨' };
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          condition: codes[data.current.weather_code] || '多云',
          city: '当前坐标',
          humidity: data.current.relative_humidity_2m,
          wind: data.current.wind_speed_10m,
          icon: data.current.weather_code === 0 ? 'Sun' : 'CloudSun',
          theme: data.current.weather_code === 0 ? 'sunny' : 'default'
        });
      } catch (e) { console.error("Weather fetch error"); }
    });
  }, []);

  // 同步衣橱数据
  useEffect(() => {
    if (!user) return;
    const itemsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'items');
    return onSnapshot(itemsCol, (snap) => {
      setWardrobe(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
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

  // --- 视图组件 ---

  const ChatView = () => (
    <div className="flex flex-col h-full space-y-4">
      {/* 天气简报卡片 */}
      <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
              {weather.icon === 'Sun' ? <Sun size={24} /> : <CloudSun size={24} />}
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{weather.city}</p>
              <h2 className="text-2xl font-black">{weather.temp}°C <span className="text-lg font-medium opacity-60">/ {weather.condition}</span></h2>
            </div>
          </div>
          <Sparkles className="text-indigo-400 animate-pulse" size={20} />
        </div>
      </div>

      {/* 聊天窗口 */}
      <div className="flex-1 bg-white/[0.03] rounded-[2.5rem] border border-white/10 p-6 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                m.role === 'ai' ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {isAiTyping && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 p-4 rounded-3xl">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="问问 AURA 今天的建议..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-6 pr-16 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
          />
          <button onClick={handleSend} disabled={isAiTyping} className="absolute right-2 top-2 p-3 bg-indigo-500 rounded-xl hover:bg-indigo-400 disabled:opacity-50 transition-all">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  const WardrobeView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">My Closet</h2>
          <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">{wardrobe.length} items collected</p>
        </div>
        <button className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20"><Plus size={24} /></button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {['全部', '上装', '下装', '鞋履', '配饰'].map(tag => (
          <button key={tag} className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold whitespace-nowrap hover:bg-white/10">{tag}</button>
        ))}
      </div>

      {wardrobe.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
            <Shirt className="text-slate-600" size={32} />
          </div>
          <p className="text-slate-500 text-sm">衣橱空空如也，快去添加单品吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {wardrobe.map(item => (
            <div key={item.id} className="aspect-[3/4] bg-white/5 rounded-[2rem] border border-white/5 overflow-hidden group relative">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs font-bold">{item.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ProfileView = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 p-1">
          <div className="w-full h-full rounded-[2.3rem] bg-[#050505] flex items-center justify-center overflow-hidden">
            <User size={40} className="text-slate-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black italic tracking-tight">STYLE ENTHUSIAST</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">ID: {user?.uid?.substring(0, 8)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { icon: <Settings size={18} />, label: '偏好设置', value: '简约 / 街头' },
          { icon: <MapPin size={18} />, label: '常驻地点', value: '自动识别' },
          { icon: <Sparkles size={18} />, label: 'Gemini 状态', value: '已激活 (2.5 Flash)' }
        ].map((item, i) => (
          <div key={i} className="flex justify-between items-center p-5 bg-white/5 border border-white/5 rounded-3xl">
            <div className="flex items-center gap-4">
              <div className="text-indigo-400">{item.icon}</div>
              <span className="text-sm font-bold text-slate-300">{item.label}</span>
            </div>
            <span className="text-xs font-medium text-slate-500">{item.value}</span>
          </div>
        ))}
      </div>

      <button onClick={() => auth.signOut()} className="w-full py-5 rounded-3xl bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest border border-red-500/20">退出登录</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[70%] bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-gradient-to-tl from-fuchsia-600/10 via-transparent to-transparent blur-[100px] rounded-full" />
      </div>

      {/* 顶部标识 */}
      <header className="relative z-20 px-8 pt-10 pb-4 flex justify-between items-center max-w-2xl mx-auto w-full">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tighter italic uppercase text-white">AURA</h1>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">The Intelligent Brain</p>
        </div>
        <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
           <LayoutGrid size={18} className="text-slate-400" />
        </div>
      </header>

      {/* 主视图区域 */}
      <main className="relative z-10 flex-1 px-8 pb-32 max-w-2xl mx-auto w-full overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'wardrobe' && <WardrobeView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* 底部 Tab 导航 */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-6">
        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 p-2 rounded-[2.5rem] flex items-center justify-between shadow-2xl">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex flex-col items-center py-3 rounded-3xl transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <MessageSquare size={20} fill={activeTab === 'chat' ? 'currentColor' : 'none'} />
            <span className="text-[8px] font-black mt-1 uppercase tracking-tighter">Brain</span>
          </button>

          <button
            onClick={() => setActiveTab('wardrobe')}
            className={`flex-1 flex flex-col items-center py-3 rounded-3xl transition-all ${activeTab === 'wardrobe' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shirt size={20} fill={activeTab === 'wardrobe' ? 'currentColor' : 'none'} />
            <span className="text-[8px] font-black mt-1 uppercase tracking-tighter">Closet</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center py-3 rounded-3xl transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User size={20} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
            <span className="text-[8px] font-black mt-1 uppercase tracking-tighter">Me</span>
          </button>
        </div>
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}