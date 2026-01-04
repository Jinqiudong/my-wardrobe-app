import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import {
  CloudSun, MapPin, Trash2, Plus, Sparkles, User,
  Layers, Zap, Camera, ChevronRight, X, Heart, Scan, Filter
} from 'lucide-react';

// --- Configuration ---
const apiKey = "";
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fashion-wardrobe-pro';
const firebaseConfig = JSON.parse(__firebase_config);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, wardrobe, suggest, profile
  const [wardrobe, setWardrobe] = useState([]);
  const [preferences, setPreferences] = useState({ style: '简约休闲', feedbackHistory: [] });
  const [isScanning, setIsScanning] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weather] = useState({ temp: 18, condition: '多云', city: '上海' });

  // Auth & Sync
  useEffect(() => {
    const init = async () => {
      try { await signInAnonymously(auth); } catch (e) {}
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'items');
    return onSnapshot(q, (s) => setWardrobe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  // AI Logic
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
    } catch (e) { return null; }
  };

  // 核心功能：模拟自动识别相册
  const handleBatchScan = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsScanning(true);
    const imagePromises = files.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    }));

    const base64Images = await Promise.all(imagePromises);

    // 批量发送给 Gemini 进行多图识别
    const prompt = `
      这是用户的多张相册照片。请识别出其中的每一件衣服。
      返回一个JSON数组: [{category: "上装/下装/鞋/外套", color: "颜色", style: "风格", reason: "AI判定理由"}]。
      只返回JSON，不要其他文字。
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
    } catch (e) { console.error("Scan error", e); }
    setIsScanning(false);
  };

  const generateOutfit = async () => {
    const place = document.getElementById('target-p')?.value || "任何地方";
    const action = document.getElementById('target-a')?.value || "日常活动";
    setLoading(true);
    const closetSummary = wardrobe.map(i => `${i.category}(${i.color})`).join(',');
    const prompt = `基于天气(${weather.temp}度, ${weather.condition})，地点(${place})，活动(${action})，从衣橱[${closetSummary}]选一套穿搭。JSON格式返回 {outfit:[{item, reason}], tip}`;
    const res = await callGemini(prompt);
    try { setAiSuggestion(JSON.parse(res.replace(/```json|```/g, ''))); } catch(e){}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-indigo-500/30">

      {/* --- Background Elements --- */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* --- Header --- */}
      <header className="relative z-10 px-6 py-8 flex justify-between items-end">
        <div>
          <p className="text-slate-400 text-sm font-medium tracking-widest uppercase mb-1">Digital Wardrobe</p>
          <h1 className="text-3xl font-extrabold tracking-tight">灵感衣橱</h1>
        </div>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl p-2 rounded-2xl border border-white/10">
          <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <CloudSun size={20} />
          </div>
          <div className="pr-2">
            <p className="text-[10px] text-slate-400 leading-none mb-1">{weather.city}</p>
            <p className="text-sm font-bold leading-none">{weather.temp}°C {weather.condition}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-32 max-w-2xl mx-auto">

        {/* --- Quick Actions Card --- */}
        <section className="mb-10">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-6 shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Zap size={20} className="fill-current text-amber-300" />
                智能同步
              </h2>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                点击下方按钮，AI 将自动识别相册中的所有衣物并同步至您的云端衣橱。
              </p>
              <label className="inline-flex items-center gap-3 bg-white text-indigo-700 px-6 py-3 rounded-2xl font-bold text-sm cursor-pointer hover:bg-slate-100 transition-all active:scale-95">
                <Scan size={18} />
                {isScanning ? '正在同步相册...' : '一键识别相册'}
                <input type="file" multiple className="hidden" onChange={handleBatchScan} accept="image/*" />
              </label>
            </div>
            <Sparkles className="absolute right-[-10px] bottom-[-10px] w-32 h-32 text-white/10 group-hover:rotate-12 transition-transform duration-700" />
          </div>
        </section>

        {/* --- Section Toggles (Non-Redundant Tabs) --- */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {['全部衣服', '上装', '下装', '鞋履', '配饰'].map((cat, i) => (
            <button key={i} className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${i===0 ? 'bg-white text-black border-white' : 'bg-transparent text-slate-400 border-white/10 hover:border-white/30'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* --- Content Grid --- */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          {wardrobe.slice(0, 4).map(item => (
            <div key={item.id} className="relative aspect-[3/4] rounded-[1.5rem] overflow-hidden group border border-white/5 bg-white/5">
              <img src={item.image} className="absolute inset-0 w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{item.category}</p>
                <p className="text-sm font-medium text-white truncate">{item.style || item.color}</p>
              </div>
              <button className="absolute top-3 right-3 p-2 bg-black/20 backdrop-blur-md rounded-full text-white/50 hover:text-red-400 transition-colors">
                <Heart size={14} />
              </button>
            </div>
          ))}
          <div
            onClick={() => setView('wardrobe')}
            className="aspect-[3/4] rounded-[1.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/5 cursor-pointer transition-colors"
          >
            <Layers className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">查看全部衣橱</span>
          </div>
        </div>

        {/* --- Assistant Logic (Suggest Section) --- */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/10 mb-20">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-300">
            <Camera size={18} />
            今日穿搭计划
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Destination</label>
              <input id="target-p" placeholder="要去哪？（如：星巴克）" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Activity</label>
              <input id="target-a" placeholder="做什么？（如：朋友聚会）" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" />
            </div>
            <button
              onClick={generateOutfit}
              disabled={loading || wardrobe.length === 0}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'AI 正在分析衣橱...' : '获取搭配建议'}
              <ChevronRight size={18} />
            </button>
          </div>

          {aiSuggestion && (
            <div className="mt-8 pt-8 border-t border-white/5 animate-in fade-in duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="font-bold text-sm uppercase tracking-widest text-indigo-400">AI Recommendation</h4>
              </div>
              <div className="space-y-4">
                {aiSuggestion.outfit.map((o, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="font-bold text-sm text-indigo-100 mb-1">{o.item}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{o.reason}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs italic text-indigo-300">“{aiSuggestion.tip}”</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Action Dock (Modern Fixed Dock) --- */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-full flex items-center gap-8 shadow-2xl">
          <button onClick={() => setView('home')} className={`relative transition-colors ${view==='home' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Zap size={22} fill={view==='home' ? 'currentColor' : 'none'} />
            {view === 'home' && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
          </button>
          <button onClick={() => setView('wardrobe')} className={`relative transition-colors ${view==='wardrobe' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Layers size={22} fill={view==='wardrobe' ? 'currentColor' : 'none'} />
            {view === 'wardrobe' && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={() => setView('profile')} className={`relative transition-colors ${view==='profile' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <User size={22} fill={view==='profile' ? 'currentColor' : 'none'} />
            {view === 'profile' && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
          </button>
        </div>
      </div>
    </div>
  );
}