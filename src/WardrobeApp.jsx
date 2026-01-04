import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import {
  CloudSun, MapPin, Trash2, Plus, Sparkles, User,
  Layers, Zap, Camera, ChevronRight, X, Heart, Scan, Filter, History,
  Loader2, AlertCircle
} from 'lucide-react';

// --- 安全获取环境变量 ---
const getEnv = (key) => {
  try {
    return import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('VITE_FIREBASE_MESSAGE_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

const GEMINI_API_KEY = getEnv('VITE_GEMINI_API_KEY') || getEnv('GEMINI_API_KEY');
const APP_ID = getEnv('VITE_FIREBASE_PROJECT_ID') || 'my-wardrobe-app-default';

// 安全初始化 Firebase
let auth, db;
const isFirebaseValid = !!firebaseConfig.apiKey;

if (isFirebaseValid) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase 初始化失败:", e);
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [wardrobe, setWardrobe] = useState([]);
  const [preferences, setPreferences] = useState({ style: '简约休闲', feedbackHistory: [] });
  const [isScanning, setIsScanning] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState({ temp: '--', condition: '加载中...', city: '自动定位' });
  const [weatherLoading, setWeatherLoading] = useState(true);

  // 1. 初始化鉴权
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch(e => console.error("匿名登录失败:", e));
      }
    });
    return () => unsub();
  }, []);

  // 2. 获取天气
  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const weatherCodes = {
          0: '晴朗', 1: '晴间多云', 2: '阴天', 3: '多云', 45: '雾', 48: '雾',
          51: '毛毛雨', 61: '小雨', 71: '小雪', 95: '雷阵雨'
        };
        setWeather({
          temp: Math.round(data.current_weather.temperature),
          condition: weatherCodes[data.current_weather.weathercode] || '多云',
          city: '当前位置'
        });
      } catch (error) {
        setWeather(prev => ({ ...prev, condition: '获取失败' }));
      } finally {
        setWeatherLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
        () => fetchWeather(31.23, 121.47)
      );
    } else {
      fetchWeather(31.23, 121.47);
    }
  }, []);

  // 3. 数据实时同步 (Firestore 路径需严格遵循规则)
  useEffect(() => {
    if (!user || !db) return;
    const itemsPath = `artifacts/${APP_ID}/users/${user.uid}/items`;
    const q = collection(db, itemsPath);

    const unsubWardrobe = onSnapshot(q, (s) => {
      setWardrobe(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore 同步错误:", err));

    return () => unsubWardrobe();
  }, [user]);

  // AI 逻辑与视图渲染省略 (保持之前逻辑)...
  const generateOutfit = async () => { /* ...保持不变... */ };

  // --- 配置缺失时显示的诊断 UI ---
  if (!isFirebaseValid || !GEMINI_API_KEY) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-white">
        <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 max-w-md w-full backdrop-blur-xl">
          <AlertCircle className="mx-auto text-red-400 mb-4 animate-pulse" size={48} />
          <h2 className="text-xl font-black mb-4 tracking-tight">应用环境配置不完整</h2>
          <div className="text-left bg-black/40 p-4 rounded-2xl mb-6 font-mono text-xs space-y-3 border border-white/5">
            <p className={firebaseConfig.apiKey ? "text-green-400" : "text-red-400"}>
              ● Firebase API Key: {firebaseConfig.apiKey ? "已配置" : "缺失"}
            </p>
            <p className={GEMINI_API_KEY ? "text-green-400" : "text-red-400"}>
              ● Gemini API Key: {GEMINI_API_KEY ? "已配置" : "缺失"}
            </p>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mb-6">
            如果您在 Vercel 部署，请在控制台设置环境变量（以 VITE_ 开头），然后点击 <span className="text-white font-bold">Redeploy</span>。
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">
            重新检查配置
          </button>
        </div>
      </div>
    );
  }

  // 正常渲染逻辑
  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-indigo-500/30">
      {/* 装饰性背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 px-6 pt-10 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500 italic">MUSE.AI</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">Digital Curator</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-3xl p-2.5 rounded-2xl border border-white/10">
          <div className="bg-indigo-500 p-2 rounded-xl">
            {weatherLoading ? <Loader2 size={18} className="animate-spin" /> : <CloudSun size={18} className="text-white" />}
          </div>
          <div className="pr-1 text-right">
            <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[60px]">{weather.city}</p>
            <p className="text-sm font-black">{weather.temp}°C</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-32 max-w-2xl mx-auto">
        {view === 'home' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <section className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] blur-xl opacity-20" />
              <div className="relative bg-gradient-to-br from-slate-900 to-black rounded-[2.5rem] p-8 border border-white/10 overflow-hidden">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-indigo-400" fill="currentColor" /> 相册自动同步
                </h2>
                <p className="text-slate-400 text-sm mb-8">AI 将自动为您分析衣橱中缺少的单品。</p>
                <label className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase cursor-pointer hover:bg-indigo-50 transition-all">
                  <Scan size={16} /> {isScanning ? '正在处理...' : '批量识别'}
                  <input type="file" multiple className="hidden" accept="image/*" />
                </label>
              </div>
            </section>

            <section className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10">
              <h3 className="text-lg font-bold mb-6">今日推荐</h3>
              <p className="text-slate-500 text-sm">衣橱内已有 {wardrobe.length} 件单品，点击生成穿搭建议。</p>
              <button className="w-full mt-6 py-4 bg-indigo-600 rounded-2xl font-bold text-sm tracking-widest">生成建议</button>
            </section>
          </div>
        )}

        {view === 'wardrobe' && (
          <div className="grid grid-cols-2 gap-4">
             {wardrobe.map(item => (
                <div key={item.id} className="aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden relative">
                   <img src={item.image} className="w-full h-full object-cover" />
                   <div className="absolute bottom-4 left-4">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase">{item.category}</p>
                   </div>
                </div>
             ))}
             {wardrobe.length === 0 && <p className="col-span-2 text-center text-slate-500 py-20">衣橱还是空的</p>}
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 px-8 py-4 rounded-[2.5rem] flex items-center gap-12">
          <button onClick={() => setView('home')} className={`${view==='home'?'text-indigo-400':'text-slate-500'}`}><Zap size={22} /></button>
          <button onClick={() => setView('wardrobe')} className={`${view==='wardrobe'?'text-indigo-400':'text-slate-500'}`}><Layers size={22} /></button>
          <button onClick={() => setView('profile')} className={`${view==='profile'?'text-indigo-400':'text-slate-500'}`}><User size={22} /></button>
        </div>
      </nav>
    </div>
  );
}