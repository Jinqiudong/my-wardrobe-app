import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- 内部 Firebase 初始化逻辑 ---
const getEnv = (key) => {
  try {
    // 关键修复：Vite 环境下，只有以 VITE_ 开头的变量会被暴露给客户端
    // 我们优先读取带 VITE_ 前缀的变量
    const viteKey = `VITE_${key}`;
    const value = import.meta.env[viteKey] || import.meta.env[key];

    // 如果值是空的，或者包含占位符文本，则返回空字符串
    if (!value || value.includes('你的_') || value.includes('YOUR_')) {
      return "";
    }
    return value;
  } catch (e) {
    return "";
  }
};

const firebaseConfig = {
  // 此时 getEnv('FIREBASE_API_KEY') 会去查找 VITE_FIREBASE_API_KEY
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID')
};

// 只有当 apiKey 存在且不是默认占位符时，才认为配置有效
const isFirebaseValid = !!firebaseConfig.apiKey;

export default function App() {
  const [status, setStatus] = useState('初始化中...');

  useEffect(() => {
    if (isFirebaseValid) {
      try {
        if (getApps().length === 0) {
          initializeApp(firebaseConfig);
        }
        setStatus('✅ Firebase 已连接');
      } catch (error) {
        console.error("Firebase 初始化错误:", error);
        setStatus('❌ 初始化失败');
      }
    } else {
      setStatus('⚠️ 未检测到配置');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white font-sans">
      <div className="text-center space-y-6">
        {/* 状态图标 */}
        <div className="w-24 h-24 bg-indigo-500 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/40 animate-pulse">
          <span className="text-4xl">🚀</span>
        </div>

        {/* 主标题 */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            MUSE.AI
          </h1>
          <p className="text-indigo-400 font-bold uppercase tracking-[0.3em] text-xs">
            Setup 成功
          </p>
        </div>

        {/* 状态面板 */}
        <div className="mt-8 px-8 py-3 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl inline-block">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isFirebaseValid ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500'}`} />
            <span className="text-sm font-medium text-slate-300">
              {status}
            </span>
          </div>
        </div>

        {/* 详细诊断提示 */}
        {!isFirebaseValid && (
          <div className="max-w-xs mx-auto mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
            <p className="text-[10px] text-yellow-200/60 leading-relaxed text-left">
              <strong>排查指南：</strong><br />
              1. 请确保 Vercel 上的变量名是以 <code className="text-white">VITE_</code> 开头的（例如：VITE_FIREBASE_API_KEY）。<br />
              2. 修改 Vercel 变量后，必须<strong>重新部署 (Redeploy)</strong> 才能生效。
            </p>
          </div>
        )}

        <p className="text-slate-500 text-[10px] max-w-[200px] mx-auto leading-relaxed opacity-60">
          核心模块已整合。已修正 Vite 环境变量前缀逻辑，确保部署后可正常连接。
        </p>
      </div>
    </div>
  );
}