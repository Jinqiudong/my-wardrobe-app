import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 获取环境变量的辅助函数
const getEnv = (key) => {
  try {
    return import.meta.env[`VITE_${key}`] || import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID') || getEnv('FIREBASE_MESSAGE_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID')
};

export const isFirebaseValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== '';

let app, auth, db;

if (isFirebaseValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase 模块加载成功");
  } catch (e) {
    console.error("Firebase 核心初始化失败:", e);
  }
} else {
  console.warn("Firebase 配置缺失，应用将运行在离线/演示模式");
}

export { auth, db, firebaseConfig }; // 导出配置对象以备调试使用
export const APP_ID = firebaseConfig.projectId || 'my-wardrobe-app';