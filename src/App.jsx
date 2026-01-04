import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import {
  CloudSun, MapPin, Trash2, Plus, Sparkles, User,
  Layers, Zap, Camera, ChevronRight, X, Heart, Scan, Filter, History
} from 'lucide-react';

// --- 配置区域 ---
const apiKey = "";
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fashion-wardrobe-pro';
const firebaseConfig = JSON.parse(__firebase_config);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, wardrobe, profile
  const [wardrobe, setWardrobe] = useState([]);
  const [preferences, setPreferences] = useState({ style: '简约休闲', feedbackHistory: [] });
  const [isScanning, setIsScanning] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weather] = useState({ temp: 18, condition: '多云', city: '上海' });

  // 1. 初始化鉴权 (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInAnonymously(auth);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth failed:", e);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. 数据实时同步 (Rule 1 & 2)
  useEffect(() => {
    if (!user) return;

    // 监听衣橱数据
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'items');
    const unsubWardrobe = onSnapshot(q, (s) => {
      setWardrobe(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore error:", err));

    // 监听用户偏好
    const prefRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'preferences');
    const unsubPref = onSnapshot(prefRef, (docSnap) => {
      if (docSnap.exists()) setPreferences(docSnap.data());
    });

    return () => {
      unsubWardrobe();
      unsubPref();
    };
  }, [user]);

  // AI 逻辑调用
  const callGemini = async (prompt, images = []) => {
    try {
      const parts = [{ text: prompt }];
      images.forEach(img => {
        parts.push({ inlineData: { mimeType: "image/png", data: img.split(',')[1] } });
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
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

  // 核心：批量识别相册照片
  const handleBatchScan = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !user) return;

    setIsScanning(true);
    const imagePromises = files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    }));

    const base64Images = await Promise.all(imagePromises);

    // 多图多模态分析
    const prompt = `
      分析这些照片中的所有衣物。
      请以 JSON 数组格式返回: [{"category": "上装/下装/鞋/外套/配饰", "color": "颜色", "style": "风格描述", "material": "材质说明"}]。
      严禁返回任何非 JSON 文本。
    `;

    const analysis = await callGemini(prompt, base64Images);
    try {
      const results = JSON.parse(analysis.replace(/```json|```/g, ''));
      for (let i = 0; i < results.length; i++) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'items'), {
          ...results[i],
          image: base64Images[i],
          createdAt: Date.now()
        });
      }
    } catch (e) {
      console.error("Batch scan parse error", e);
    }
    setIsScanning(false);
  };

  // 生成穿搭建议逻辑
  const generateOutfit = async () => {
    const place = document.getElementById('target-p')?.value || "任何地方";
    const action = document.getElementById('target-a')?.value || "日常活动";
    setLoading(true);

    const closetSummary = wardrobe.map(i => `${i.category}(${i.color}, ${i.style})`).join('; ');
    const history = preferences.feedbackHistory?.slice(-3).map(f => f.comment).join('; ') || "无";

    const prompt = `
      作为时尚顾问，基于以下信息给出一套穿搭建议：
      1. 天气: ${weather.city} ${weather.temp}度 ${weather.condition}
      2. 场合: 去${place}参加${action}
      3. 用户风格: ${preferences.style}
      4. 历史偏好反馈: ${history}
      5. 可选衣橱: ${closetSummary}
      请以 JSON 格式返回: {"outfit": [{"item": "名称", "reason": "理由"}], "tip": "今日穿搭金句"}。
    `;

    const res = await callGemini(prompt);
    try {
      setAiSuggestion(JSON.parse(res.replace(/```json|```/g, '')));
    } catch (e) {
      console.error("AI parse error", e);
    }
    setLoading(false);
  };

  // 提交体感反馈
  const submitFeedback = async (score, comment) => {
    if (!user) return;
    const newFeedback = { score, comment, date: new Date().toLocaleDateString() };
    const updatedHistory = [...(preferences.feedbackHistory || []), newFeedback];
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'preferences'), {
      ...preferences,
      feedbackHistory: updatedHistory
    }, { merge: true });
    setAiSuggestion(null);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-indigo-500/30">

      {/* 动态背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      {/* 顶部状态栏风格 Header */}
      <header className="relative z-10 px-6 pt-10 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500 italic">
            MUSE.AI
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">Digital Curator</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-3xl p-2.5 rounded-2xl border border-white/10 shadow-2xl">
          <div className="bg-indigo-500 p-2 rounded-xl">
            <CloudSun size={18} className="text-white" />
          </div>
          <div className="pr-1 text-right">
            <p className="text-[9px] text-slate-400 font-bold leading-none mb-1 uppercase tracking-wider">{weather.city}</p>
            <p className="text-sm font-black leading-none">{weather.temp}°C</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-32 max-w-2xl mx-auto">

        {/* 1. 首页视图 (灵感中心) */}
        {view === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 批量同步卡片 */}
            <section className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative bg-gradient-to-br from-slate-900 to-black rounded-[2.5rem] p-8 border border-white/10 overflow-hidden shadow-2xl">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                      <Zap size={20} fill="currentColor" />
                    </div>
                    <h2 className="text-xl font-bold">同步您的相册</h2>
                  </div>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-[80%]">
                    不再需要逐一手动录入。AI 将自动扫描您的相册，识别所有衣物、颜色及风格，并为您构建数字档案。
                  </p>
                  <label className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-indigo-50 transition-all active:scale-95 shadow-xl">
                    <Scan size={16} />
                    {isScanning ? '正在处理相册...' : '一键自动识别'}
                    <input type="file" multiple className="hidden" onChange={handleBatchScan} accept="image/*" />
                  </label>
                </div>
                <Sparkles className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
              </div>
            </section>

            {/* 快速生成建议区 */}
            <section className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Camera size={18} className="text-indigo-400" />
                  今日穿搭引擎
                </h3>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-500 font-black ml-1 tracking-widest">Destination</label>
                    <input id="target-p" placeholder="要去哪？" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-700 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-500 font-black ml-1 tracking-widest">Activity</label>
                    <input id="target-a" placeholder="干什么？" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-700 text-sm" />
                  </div>
                </div>
                <button
                  onClick={generateOutfit}
                  disabled={loading || wardrobe.length === 0}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all disabled:opacity-20 active:scale-[0.98]"
                >
                  {loading ? 'Consulting Gemini AI...' : '生成当日穿搭方案'}
                </button>
              </div>

              {aiSuggestion && (
                <div className="mt-10 pt-10 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <h4 className="font-black text-[10px] uppercase tracking-[0.3em] text-indigo-400">Curated Solution</h4>
                  </div>
                  <div className="space-y-4">
                    {aiSuggestion.outfit.map((o, idx) => (
                      <div key={idx} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">0{idx+1}</div>
                        <div>
                          <p className="font-bold text-sm text-white mb-1.5">{o.item}</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{o.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 p-6 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 text-center">
                    <p className="text-xs italic text-indigo-200 font-medium">“{aiSuggestion.tip}”</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => submitFeedback(5, "这套很舒服")} className="flex-1 py-3 rounded-xl bg-green-500/10 text-green-500 text-[10px] font-bold uppercase border border-green-500/20">体感舒适</button>
                    <button onClick={() => submitFeedback(1, "有点冷/热")} className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-bold uppercase border border-red-500/20">体感不佳</button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* 2. 衣橱列表视图 */}
        {view === 'wardrobe' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black italic tracking-tight uppercase">My Inventory</h2>
              <button className="p-2 bg-white/5 rounded-xl border border-white/10 text-slate-400">
                <Filter size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {wardrobe.map(item => (
                <div key={item.id} className="relative aspect-[4/5] rounded-[2rem] overflow-hidden group border border-white/5 bg-slate-900 shadow-xl">
                  <img src={item.image} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">{item.category}</p>
                    <p className="text-sm font-bold text-white truncate">{item.color} {item.style}</p>
                  </div>
                  <button
                    onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'items', item.id))}
                    className="absolute top-4 right-4 p-2.5 bg-black/40 backdrop-blur-xl rounded-full text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {wardrobe.length === 0 && (
                <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
                  <Layers className="mx-auto text-slate-700 mb-4" size={32} />
                  <p className="text-slate-500 font-medium">衣橱空空如也</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. 个人风格中心 */}
        {view === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2">
                <User size={16} /> 核心穿衣风格
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {['简约', '美式复古', '职场通勤', '运动休闲', '多巴胺', '极简主义'].map(s => (
                  <button
                    key={s}
                    onClick={() => setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'preferences'), { ...preferences, style: s }, { merge: true })}
                    className={`py-4 rounded-2xl text-xs font-bold transition-all border ${preferences.style === s ? 'bg-white text-black border-white' : 'bg-transparent text-slate-500 border-white/5 hover:border-white/20'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 px-2 flex items-center gap-2">
                <History size={16} /> 近期体感记录
              </h3>
              {preferences.feedbackHistory?.slice().reverse().map((f, i) => (
                <div key={i} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">{f.comment}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{f.date}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${f.score === 5 ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
                    {f.score === 5 ? 'Comfortable' : 'Adjusted'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- 现代底部悬浮 Dock (唯一导航) --- */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 px-8 py-5 rounded-[2.5rem] flex items-center gap-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setView('home')}
            className={`relative transition-all duration-300 ${view==='home' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Zap size={22} fill={view==='home' ? 'currentColor' : 'none'} />
            {view === 'home' && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]" />}
          </button>

          <button
            onClick={() => setView('wardrobe')}
            className={`relative transition-all duration-300 ${view==='wardrobe' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Layers size={22} fill={view==='wardrobe' ? 'currentColor' : 'none'} />
            {view === 'wardrobe' && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]" />}
          </button>

          <button
            onClick={() => setView('profile')}
            className={`relative transition-all duration-300 ${view==='profile' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User size={22} fill={view==='profile' ? 'currentColor' : 'none'} />
            {view === 'profile' && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]" />}
          </button>
        </div>
      </div>
    </div>
  );
}