import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import {
  CloudSun, MapPin, Trash2, Plus, Sparkles, User,
  Layers, Zap, Camera, ChevronRight, X, Heart, Scan, Filter, History,
  Loader2
} from 'lucide-react';

// --- 安全获取环境变量 ---
const getEnv = (key) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return '';
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGE_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

const GEMINI_API_KEY = getEnv('GEMINI_API_KEY');
const APP_ID = getEnv('VITE_FIREBASE_PROJECT_ID') || 'my-wardrobe-app-21ec5';

// 初始化 Firebase 服务
let app, auth, db;
if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [wardrobe, setWardrobe] = useState([]);
  const [preferences, setPreferences] = useState({ style: '简约休闲', feedbackHistory: [] });
  const [isScanning, setIsScanning] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- 天气相关状态 ---
  const [weather, setWeather] = useState({ temp: '--', condition: '加载中...', city: '自动定位' });
  const [weatherLoading, setWeatherLoading] = useState(true);

  // 1. 获取地理定位与天气 API
  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        // 使用 Open-Meteo 免费 API
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();

        // 映射天气代码到中文描述
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
        console.error("天气获取失败", error);
        setWeather(prev => ({ ...prev, condition: '获取失败' }));
      } finally {
        setWeatherLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("无法获取定位", error);
          fetchWeather(31.23, 121.47); // 失败时默认上海
        }
      );
    } else {
      fetchWeather(31.23, 121.47);
    }
  }, []);

  // 2. 初始化鉴权
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Firebase Auth Error:", e);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 3. 数据实时同步
  useEffect(() => {
    if (!user || !db) return;

    const q = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'items');
    const unsubWardrobe = onSnapshot(q, (s) => {
      setWardrobe(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore sync error:", err));

    const prefRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'preferences');
    const unsubPref = onSnapshot(prefRef, (docSnap) => {
      if (docSnap.exists()) setPreferences(docSnap.data());
    });

    return () => {
      unsubWardrobe();
      unsubPref();
    };
  }, [user]);

  // AI 调用逻辑
  const callGemini = async (prompt, images = []) => {
    if (!GEMINI_API_KEY) return null;
    try {
      const parts = [{ text: prompt }];
      images.forEach(img => {
        parts.push({ inlineData: { mimeType: "image/png", data: img.split(',')[1] } });
      });
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      return null;
    }
  };

  const handleBatchScan = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !user || !db) return;
    setIsScanning(true);
    const imagePromises = files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    }));
    const base64Images = await Promise.all(imagePromises);
    const prompt = `分析这些照片中的衣物。返回 JSON 数组格式: [{"category": "上装/下装/鞋/外套/配饰", "color": "颜色", "style": "风格", "material": "材质"}]。`;
    const analysis = await callGemini(prompt, base64Images);
    if (analysis) {
      try {
        const cleanJson = analysis.replace(/```json|```/g, '').trim();
        const results = JSON.parse(cleanJson);
        for (let i = 0; i < results.length; i++) {
          await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'items'), {
            ...results[i], image: base64Images[i], createdAt: Date.now()
          });
        }
      } catch (e) {}
    }
    setIsScanning(false);
  };

  const generateOutfit = async () => {
    const place = document.getElementById('target-p')?.value || "任何地方";
    const action = document.getElementById('target-a')?.value || "日常活动";
    setLoading(true);
    const closetSummary = wardrobe.map(i => `${i.category}(${i.color}, ${i.style})`).join('; ');
    const prompt = `基于天气 ${weather.condition}，气温 ${weather.temp}度，场合为去${place}参加${action}，从衣橱：${closetSummary} 中推荐一套穿搭。返回 JSON: {"outfit": [{"item": "名称", "reason": "理由"}], "tip": "今日穿搭金句"}。`;
    const res = await callGemini(prompt);
    if (res) {
      try {
        const cleanJson = res.replace(/```json|```/g, '').trim();
        setAiSuggestion(JSON.parse(cleanJson));
      } catch (e) {}
    }
    setLoading(false);
  };

  if (!firebaseConfig.apiKey) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-center">
        <div className="bg-white/5 p-8 rounded-3xl border border-white/10 max-w-sm">
          <Sparkles className="mx-auto text-indigo-400 mb-4" size={40} />
          <h2 className="text-xl font-bold mb-2">配置缺失</h2>
          <p className="text-slate-400 text-sm">请在 Vercel 中设置环境变量并重新部署。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-indigo-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <header className="relative z-10 px-6 pt-10 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500 italic">
            MUSE.AI
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">Digital Curator</p>
        </div>

        {/* 天气组件 */}
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
          <div className="space-y-8">
            <section className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] blur-xl opacity-20" />
              <div className="relative bg-gradient-to-br from-slate-900 to-black rounded-[2.5rem] p-8 border border-white/10 overflow-hidden shadow-2xl">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Zap size={20} className="text-indigo-400" fill="currentColor" />
                    相册自动同步
                  </h2>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    AI 将扫描您的相册。当前天气：{weather.condition}，建议选择适合{weather.temp > 25 ? '清凉' : '保暖'}的衣物。
                  </p>
                  <label className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-indigo-50 transition-all active:scale-95">
                    <Scan size={16} />
                    {isScanning ? '正在识别...' : '开始批量识别'}
                    <input type="file" multiple className="hidden" onChange={handleBatchScan} accept="image/*" />
                  </label>
                </div>
              </div>
            </section>

            <section className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10">
              <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                <Camera size={18} className="text-indigo-400" />
                今日计划
              </h3>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <input id="target-p" placeholder="要去哪？" className="bg-white/5 border border-white/5 rounded-2xl p-4 outline-none placeholder:text-slate-700 text-sm" />
                  <input id="target-a" placeholder="活动内容" className="bg-white/5 border border-white/5 rounded-2xl p-4 outline-none placeholder:text-slate-700 text-sm" />
                </div>
                <button
                  onClick={generateOutfit}
                  disabled={loading || wardrobe.length === 0}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg disabled:opacity-20"
                >
                  {loading ? 'AI 规划中...' : '生成建议'}
                </button>
              </div>

              {aiSuggestion && (
                <div className="mt-10 pt-10 border-t border-white/5">
                  <div className="space-y-4">
                    {aiSuggestion.outfit.map((o, idx) => (
                      <div key={idx} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">{idx+1}</div>
                        <div>
                          <p className="font-bold text-sm text-white">{o.item}</p>
                          <p className="text-xs text-slate-400">{o.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 text-center">
                    <p className="text-xs italic text-indigo-300">“{aiSuggestion.tip}”</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'wardrobe' && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
            {wardrobe.map(item => (
              <div key={item.id} className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-slate-900 border border-white/5 group">
                <img src={item.image} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.category}</p>
                  <p className="text-sm font-bold text-white truncate">{item.style}</p>
                </div>
                <button
                  onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'items', item.id))}
                  className="absolute top-4 right-4 p-2 bg-black/40 rounded-full text-white/30 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {wardrobe.length === 0 && <div className="col-span-2 py-20 text-center opacity-30 italic text-sm">衣橱空空的，快去识别新衣！</div>}
          </div>
        )}

        {view === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10">
              <h3 className="text-sm font-black uppercase text-indigo-400 mb-6 tracking-widest">我的风格</h3>
              <div className="grid grid-cols-2 gap-3">
                {['简约', '美式复古', '职场通勤', '运动休闲'].map(s => (
                  <button
                    key={s}
                    onClick={() => setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'preferences'), { ...preferences, style: s }, { merge: true })}
                    className={`py-4 rounded-2xl text-xs font-bold border transition-all ${preferences.style === s ? 'bg-white text-black' : 'text-slate-500 border-white/5'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-[2.5rem] flex items-center gap-12 shadow-2xl">
          <button onClick={() => setView('home')} className={`${view==='home' ? 'text-indigo-400' : 'text-slate-500'}`}><Zap size={22} /></button>
          <button onClick={() => setView('wardrobe')} className={`${view==='wardrobe' ? 'text-indigo-400' : 'text-slate-500'}`}><Layers size={22} /></button>
          <button onClick={() => setView('profile')} className={`${view==='profile' ? 'text-indigo-400' : 'text-slate-500'}`}><User size={22} /></button>
        </div>
      </div>
    </div>
  );
}