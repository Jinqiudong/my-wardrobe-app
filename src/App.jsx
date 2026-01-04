import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, doc, addDoc, updateDoc } from 'firebase/firestore';
import {
  CloudSun, MapPin, Trash2, Plus, Sparkles, User,
  Layers, Zap, Camera, ChevronRight, X, Heart, Scan, Filter, History,
  Loader2, AlertCircle
} from 'lucide-react';

// --- 内部 Firebase & 配置逻辑 ---
const getEnv = (key) => {
  try {
    return import.meta.env[`VITE_${key}`] || import.meta.env[key] || "";
  } catch (e) {
    return "";
  }
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
const APP_ID = firebaseConfig.projectId || 'wardrobe-ai-default';

let auth, db;
if (isFirebaseValid) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Gemini AI 服务逻辑 ---
async function analyzeClothingImage(base64Image) {
  const apiKey = ""; // 运行时由环境提供
  const systemPrompt = "你是一位时尚专家。分析这张衣物图片并返回 JSON：{ category: '上装/下装/鞋/配饰', color: '颜色', style: '风格描述', tags: ['标签1', '标签2'] }";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
          ]
        }]
      })
    });
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    // 清理可能存在的 Markdown 代码块标记
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini 分析失败:", error);
    return { category: '未知', color: '未知', style: '休闲', tags: [] };
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [wardrobe, setWardrobe] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState({ temp: '--', condition: '加载中...', city: '自动定位' });
  const [weatherLoading, setWeatherLoading] = useState(true);

  // 1. 初始化鉴权 (遵循 RULE 3)
  useEffect(() => {
    if (!isFirebaseValid) return;

    const initAuth = async () => {
      try {
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("登录失败:", e);
      }
    };

    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // 2. 实时监听衣橱 (遵循 RULE 1 & 2)
  useEffect(() => {
    if (!user || !db) return;

    const itemsCol = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'items');
    const unsubscribe = onSnapshot(itemsCol,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWardrobe(items);
      },
      (error) => console.error("Firestore 监听错误:", error)
    );

    return () => unsubscribe();
  }, [user]);

  // 3. 获取天气
  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        setWeather({
          temp: Math.round(data.current_weather.temperature),
          condition: '晴朗',
          city: '我的位置'
        });
      } catch (e) {
        setWeather({ temp: 22, condition: '多云', city: '默认城市' });
      } finally {
        setWeatherLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
        () => fetchWeather(31.23, 121.47)
      );
    }
  }, []);

  // 模拟拍照分析
  const handleScan = async () => {
    // 实际生产中这里会通过 <input type="file"> 或 Camera API 获取图片
    setLoading(true);
    // 模拟一张 base64 (占位符)
    const mockImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const analysis = await analyzeClothingImage(mockImage);

    if (user && db) {
      const itemsCol = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'items');
      await addDoc(itemsCol, {
        ...analysis,
        image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80", // 模拟上传后的URL
        createdAt: Date.now()
      });
    }
    setLoading(false);
    setView('wardrobe');
  };

  if (!isFirebaseValid) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-8">
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] text-center max-w-sm">
          <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">配置错误</h2>
          <p className="text-slate-400 text-sm">请检查环境变量设置，Firebase API Key 不能为空。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-indigo-500/30">
      {/* 氛围背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <header className="relative z-10 px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
            MUSE.AI
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">
            {user ? `ID: ${user.uid.substring(0, 8)}` : '正在同步...'}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-3xl p-2 rounded-2xl border border-white/10 flex items-center gap-3 pr-4">
          <div className="bg-indigo-500 p-2 rounded-xl">
            {weatherLoading ? <Loader2 size={16} className="animate-spin" /> : <CloudSun size={16} />}
          </div>
          <div>
            <p className="text-xs font-black leading-none">{weather.temp}°C</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{weather.condition}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-32 max-w-lg mx-auto">
        {view === 'home' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="bg-gradient-to-br from-slate-900 to-black p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-30 transition-opacity">
                  <Scan size={80} className="text-indigo-400" />
               </div>
               <h2 className="text-xl font-bold mb-2">智能扫描</h2>
               <p className="text-slate-400 text-sm mb-8 max-w-[200px]">利用 Gemini AI 识别您的衣物并自动分类入库。</p>
               <button
                onClick={handleScan}
                disabled={loading}
                className="bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
               >
                 {loading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                 {loading ? '分析中...' : '开始扫描'}
               </button>
            </section>

            <section className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem]">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold">穿搭建议</h3>
                  <Sparkles size={18} className="text-indigo-400" />
               </div>
               <p className="text-slate-400 text-sm leading-relaxed mb-6">
                 基于今天的 <span className="text-white">{weather.condition}</span> 天气和您的 <span className="text-white">{wardrobe.length}</span> 件藏品，为您生成最佳方案。
               </p>
               <button className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                 生成今日搭配
               </button>
            </section>
          </div>
        )}

        {view === 'wardrobe' && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
             {wardrobe.map(item => (
                <div key={item.id} className="aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden relative border border-white/5">
                   <img src={item.image} className="w-full h-full object-cover" alt={item.category} />
                   <div className="absolute bottom-4 left-4">
                      <span className="text-[10px] font-black text-indigo-400 uppercase bg-black/60 px-2 py-1 rounded-md">
                        {item.category}
                      </span>
                   </div>
                </div>
             ))}
             {wardrobe.length === 0 && (
                <div className="col-span-2 py-32 text-center text-slate-600 italic">
                   <Layers size={48} className="mx-auto mb-4 opacity-20" />
                   <p>衣橱空空如也，快去扫描吧</p>
                </div>
             )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-950/80 backdrop-blur-3xl border border-white/10 px-8 py-4 rounded-[2.5rem] flex items-center gap-12 shadow-2xl">
          <button onClick={() => setView('home')} className={`transition-all ${view==='home'?'text-indigo-400 scale-125':'text-slate-600'}`}>
            <Zap size={22} fill={view === 'home' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setView('wardrobe')} className={`transition-all ${view==='wardrobe'?'text-indigo-400 scale-125':'text-slate-600'}`}>
            <Layers size={22} fill={view === 'wardrobe' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setView('profile')} className={`transition-all ${view==='profile'?'text-indigo-400 scale-125':'text-slate-600'}`}>
            <User size={22} fill={view === 'profile' ? 'currentColor' : 'none'} />
          </button>
        </div>
      </nav>
    </div>
  );
}