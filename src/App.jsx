import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import {
  Zap, Layers, User, CloudSun, Loader2,
  Camera, Sparkles, Filter, ChevronRight,
  Plus, Scan, Shirt, LayoutGrid
} from 'lucide-react';

// --- 内部 Firebase 初始化逻辑 (保持之前的成功连接配置) ---
const getEnv = (key) => {
  try {
    const viteKey = `VITE_${key}`;
    const value = import.meta.env[viteKey] || import.meta.env[key];
    return (!value || value.includes('你的_') || value.includes('YOUR_')) ? "" : value;
  } catch (e) { return ""; }
};

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID')
};

const isFirebaseValid = !!firebaseConfig.apiKey;
const APP_ID = firebaseConfig.projectId || 'muse-ai-default';

let auth, db;
if (isFirebaseValid) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, wardrobe, profile
  const [wardrobe, setWardrobe] = useState([]);
  const [weather, setWeather] = useState({ temp: 24, condition: '晴朗', city: '上海' });
  const [loading, setLoading] = useState(false);

  // 鉴权逻辑
  useEffect(() => {
    if (!isFirebaseValid) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth);
    });
    return () => unsub();
  }, []);

  // 数据监听
  useEffect(() => {
    if (!user || !db) return;
    const itemsCol = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'items');
    return onSnapshot(itemsCol, (snap) => {
      setWardrobe(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Firestore Error:", err));
  }, [user]);

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* 全局背景氛围灯 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[100px] rounded-full" />
      </div>

      {/* 顶部状态栏 */}
      <header className="relative z-10 px-6 pt-12 pb-6 flex justify-between items-end max-w-lg mx-auto">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          <h1 className="text-3xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
            MUSE.AI
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">
            {user ? `Authenticated / ${user.uid.substring(0, 6)}` : 'Syncing...'}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-3xl p-2 rounded-2xl border border-white/10 flex items-center gap-3 pr-4 animate-in fade-in slide-in-from-right-4 duration-700">
          <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <CloudSun size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black leading-none">{weather.temp}°C</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{weather.condition}</span>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="relative z-10 px-6 pb-32 max-w-lg mx-auto">

        {/* 首页视图 */}
        {view === 'home' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* 核心 AI 扫描入口 */}
            <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-8 rounded-[3rem] border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-25 transition-opacity duration-500">
                <Scan size={90} className="text-indigo-400" />
              </div>

              <div className="relative z-10">
                <div className="bg-white/10 w-fit p-3 rounded-2xl mb-6 backdrop-blur-md border border-white/10">
                  <Sparkles size={24} className="text-indigo-300" />
                </div>
                <h2 className="text-2xl font-bold mb-2 tracking-tight">智能识别单品</h2>
                <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-[220px]">
                  让 Gemini AI 自动为您分析衣物的材质、颜色和穿搭场合。
                </p>
                <button className="bg-white text-black w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-200 active:scale-95 transition-all shadow-xl shadow-white/5">
                  <Camera size={18} />
                  开始扫描
                </button>
              </div>
            </section>

            {/* 快捷推荐卡片 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] flex flex-col justify-between aspect-square group hover:bg-white/10 transition-colors">
                <div className="bg-indigo-500/20 w-fit p-3 rounded-2xl border border-indigo-500/20">
                  <Shirt size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">今日穿搭</h3>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">根据天气为您生成</p>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] flex flex-col justify-between aspect-square group hover:bg-white/10 transition-colors">
                <div className="bg-emerald-500/20 w-fit p-3 rounded-2xl border border-emerald-500/20">
                  <LayoutGrid size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">衣橱整理</h3>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">管理 {wardrobe.length} 件单品</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 衣橱视图 */}
        {view === 'wardrobe' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">我的收藏</h2>
              <button className="bg-white/5 p-3 rounded-xl border border-white/10">
                <Filter size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {wardrobe.map((item, idx) => (
                <div key={item.id || idx} className="group relative aspect-[3/4] bg-slate-900 rounded-[2rem] overflow-hidden border border-white/5 transition-transform hover:scale-[1.02]">
                  <img src={item.image || `https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80`} className="w-full h-full object-cover" alt="clothing" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4">
                    <span className="text-[9px] font-black text-indigo-400 uppercase bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                      {item.category || 'T-Shirt'}
                    </span>
                  </div>
                </div>
              ))}

              {/* 空状态占位 */}
              {wardrobe.length === 0 && [1,2,3,4].map(i => (
                <div key={i} className="aspect-[3/4] bg-white/5 rounded-[2rem] border border-white/5 border-dashed flex items-center justify-center">
                  <Plus className="text-slate-800" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 个人中心视图 */}
        {view === 'profile' && (
          <div className="animate-in fade-in duration-500 text-center py-20">
            <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl mb-6">
              <User size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold italic tracking-tight">MUSE Explorer</h2>
            <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">VIP 抢先体验版</p>
          </div>
        )}
      </main>

      {/* 极简悬浮导航栏 */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-950/80 backdrop-blur-3xl border border-white/10 px-10 py-5 rounded-[2.8rem] flex items-center gap-14 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setView('home')}
            className={`transition-all duration-300 transform active:scale-75 ${view === 'home' ? 'text-indigo-400 scale-125' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <Zap size={24} fill={view === 'home' ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={() => setView('wardrobe')}
            className={`transition-all duration-300 transform active:scale-75 ${view === 'wardrobe' ? 'text-indigo-400 scale-125' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <Layers size={24} fill={view === 'wardrobe' ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={() => setView('profile')}
            className={`transition-all duration-300 transform active:scale-75 ${view === 'profile' ? 'text-indigo-400 scale-125' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <User size={24} fill={view === 'profile' ? 'currentColor' : 'none'} />
          </button>
        </div>
      </nav>
    </div>
  );
}