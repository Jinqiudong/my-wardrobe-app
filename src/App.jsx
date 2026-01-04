import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, query, orderBy } from 'firebase/firestore';
import {
  Zap, Compass, User, CloudSun, Loader2,
  Camera, Sparkles, Filter, ChevronRight,
  Plus, Scan, Shirt, LayoutGrid, X,
  MessageSquare, Heart, Settings, Image as ImageIcon,
  Languages, RefreshCw, Send, Smartphone, MapPin,
  Wind, Droplets, Sun, CloudRain
} from 'lucide-react';

// --- 配置与初始化 ---
const apiKey = ""; // 运行时环境自动提供
const getEnv = (key) => {
  try {
    // 优先尝试从窗口全局变量读取环境配置
    if (typeof window !== 'undefined' && window[key]) return window[key];
    return import.meta.env[key] || "";
  } catch (e) { return ""; }
};

const firebaseConfigStr = getEnv('__firebase_config');
const firebaseConfig = firebaseConfigStr ? JSON.parse(firebaseConfigStr) : {};
const appId = getEnv('__app_id') || 'aura-ai-closet';

let auth = null;
let db = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

// 图标映射表，用于解决渲染对象错误
const IconMap = {
  Sun: Sun,
  CloudSun: CloudSun,
  CloudRain: CloudRain,
  MapPin: MapPin
};

// --- 组件开始 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('general');
  const [wardrobe, setWardrobe] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [inputMsg, setInputMsg] = useState('');

  // 天气与位置
  const [weather, setWeather] = useState({
    temp: '--',
    condition: '定位中...',
    city: '正在识别',
    humidity: '--',
    wind: '--',
    icon: 'CloudSun' // 存储字符串而非对象
  });

  const [messages, setMessages] = useState([
    { role: 'ai', text: '你好，我是 AURA。我已经准备好为你挑选今天的穿搭了。' }
  ]);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // 1. Firebase 认证与初始化
  useEffect(() => {
    if (!auth) {
      console.warn("Auth not initialized, operating in local mode.");
      return;
    }

    const initAuth = async () => {
      try {
        const token = getEnv('__initial_auth_token');
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };

    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsub();
  }, []);

  // 2. 获取地理位置与天气
  useEffect(() => {
    const fetchWeather = async () => {
      if (!navigator.geolocation) {
        setWeather(prev => ({ ...prev, condition: '不支持定位' }));
        return;
      }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
          const data = await res.json();

          const codes = { 0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴天', 45: '雾', 61: '小雨', 95: '雷阵雨' };
          const currentT = Math.round(data.current.temperature_2m);
          const currentC = codes[data.current.weather_code] || '多云';
          const iconKey = data.current.weather_code === 0 ? 'Sun' : 'CloudSun';

          setWeather({
            temp: currentT,
            condition: currentC,
            city: '当前位置',
            humidity: data.current.relative_humidity_2m,
            wind: data.current.wind_speed_10m,
            icon: iconKey
          });

          // 自动发送一条天气相关的 AI 问候
          setMessages(prev => [...prev, {
            role: 'ai',
            text: `检测到你所在位置气温 ${currentT}°C，天气${currentC}。需要我根据你的衣橱建议今天的 OOTD 吗？`
          }]);
        } catch (e) {
          console.error("Weather Error", e);
          setWeather(prev => ({ ...prev, condition: '获取失败' }));
        }
      }, (err) => {
        console.error("Geo Error", err);
        setWeather(prev => ({ ...prev, condition: '定位被拒绝' }));
      });
    };
    fetchWeather();
  }, []);

  // 3. 实时监听衣橱
  useEffect(() => {
    if (!user || !db) return;
    try {
      const itemsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'items');
      return onSnapshot(itemsCol, (snap) => {
        setWardrobe(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error("Firestore Listen Error:", err));
    } catch (err) {
      console.error("Firestore Setup Error:", err);
    }
  }, [user]);

  // 4. 自动滚动聊天到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiTyping]);

  // 5. Gemini Chatbot 逻辑 (带退避重试)
  const callGemini = async (prompt, retryCount = 0) => {
    const systemPrompt = `你是一个名为 AURA 的 AI 穿搭助手。你非常了解用户的审美。
    当前环境信息：地点: ${weather.city}, 温度: ${weather.temp}°C, 天气: ${weather.condition}。
    用户衣橱单品数: ${wardrobe.length}件。
    请根据这些信息给出专业、时髦、富有同理心的穿搭建议。回答要简洁精炼。使用中文回答。`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });

      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "我还在思考中，请稍后再问。";
    } catch (error) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(res => setTimeout(res, delay));
        return callGemini(prompt, retryCount + 1);
      }
      return "抱歉，我的大脑暂时连接不上。请检查网络或稍后再试。";
    }
  };

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

  // 动态渲染天气图标
  const WeatherIcon = IconMap[weather.icon] || CloudSun;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* 动态氛围背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/5 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-20 px-6 pt-10 pb-4 flex justify-between items-center max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
            AURA
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">AI Personal Agent</span>
          </div>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
          <Settings size={20} className="text-slate-300" />
        </button>
      </header>

      <main className="relative z-10 px-6 pb-32 max-w-2xl mx-auto min-h-[75vh]">
        {view === 'general' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            {/* 聊天容器 */}
            <div className="bg-gradient-to-b from-white/5 to-transparent p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
              <div ref={scrollRef} className="space-y-4 h-[45vh] overflow-y-auto mb-6 pr-2 scroll-smooth custom-scrollbar">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                      m.role === 'ai' ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isAiTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                      <span className="text-xs text-slate-400">AURA 正在思考...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入交互 */}
              <div className="relative group">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="询问穿搭建议、搭配今天的天气..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-6 pr-16 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={isAiTyping}
                  className="absolute right-2.5 top-2.5 p-2.5 bg-indigo-500 rounded-xl hover:bg-indigo-400 disabled:opacity-50 shadow-lg shadow-indigo-500/30"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            {/* 实时状态看板 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 group hover:bg-white/10 transition-all">
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                      <WeatherIcon size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{weather.city}</p>
                      <p className="text-sm font-black italic">{weather.temp}°C {weather.condition}</p>
                    </div>
                 </div>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-center gap-4">
                 <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400"><Shirt size={18} /></div>
                 <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">我的衣橱</p>
                    <p className="text-sm font-black italic">{wardrobe.length} 件单品</p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* 其他视图占位 */}
        {view === 'social' && <div className="text-center py-20 text-slate-500 italic">正在寻找审美灵感...</div>}
        {view === 'showroom' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            <div className="w-48 h-72 bg-white/5 rounded-[3rem] border border-white/10 flex items-center justify-center">
              <User size={80} className="text-white/5" />
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-black">数字人像模块生成中</p>
          </div>
        )}
      </main>

      {/* 导航 */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-950/80 backdrop-blur-3xl border border-white/10 px-10 py-5 rounded-[3rem] flex items-center gap-14 shadow-2xl">
          <button onClick={() => setView('general')} className={`transition-all ${view === 'general' ? 'text-indigo-400 scale-125' : 'text-slate-600'}`}>
            <MessageSquare size={24} fill={view === 'general' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setView('social')} className={`transition-all ${view === 'social' ? 'text-indigo-400 scale-125' : 'text-slate-600'}`}>
            <Compass size={24} />
          </button>
          <button onClick={() => setView('showroom')} className={`transition-all ${view === 'showroom' ? 'text-indigo-400 scale-125' : 'text-slate-600'}`}>
            <LayoutGrid size={24} fill={view === 'showroom' ? 'currentColor' : 'none'} />
          </button>
        </div>
      </nav>

      {/* 设置面板 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-[#0a0a0a] w-full max-w-md border border-white/10 rounded-[3rem] p-8 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-black uppercase tracking-tight">Settings</h3>
               <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 3000); }}
                className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <Smartphone size={20} className="text-indigo-400" />
                  <div className="text-left">
                    <p className="text-sm font-bold">同步相册</p>
                    <p className="text-[10px] text-slate-500">自动识别近期穿搭照片</p>
                  </div>
                </div>
                {syncing && <Loader2 size={16} className="animate-spin" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}