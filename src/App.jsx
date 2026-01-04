import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- 内部 Firebase 初始化逻辑 ---
// 为了解决编译路径问题，我们将配置直接放在 App 组件同级
const getEnv = (key) => {
  try {
    // 兼容不同的环境读取方式
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

// 检查 Firebase 配置是否可用
const isFirebaseValid = !!firebaseConfig.apiKey;

export default function App() {
  const [status, setStatus] = useState('初始化中...');

  useEffect(() => {
    if (isFirebaseValid) {
      try {
        // 初始化 Firebase 防止重复初始化
        if (getApps().length === 0) {
          initializeApp(firebaseConfig);
        }
        setStatus('✅ Firebase 已连接');
      } catch (error) {
        console.error("Firebase 初始化错误:", error);
        setStatus('❌ 初始化失败');
      }
    } else {
      setStatus('⚠️ 缺少 Firebase Key');
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

        {/* 说明文字 */}
        <p className="text-slate-500 text-[10px] max-w-[200px] mx-auto leading-relaxed opacity-60">
          核心模块已整合，路径解析错误已修复。现在可以开始构建您的智能衣橱。
        </p>
      </div>
    </div>
  );
}