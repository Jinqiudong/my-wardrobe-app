import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './WardrobeApp';

// 获取 HTML 中的挂载点
const rootElement = document.getElementById('root');

const startApp = () => {
  if (rootElement) {
    try {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log("MUSE.AI: 应用已成功挂载。");
    } catch (error) {
      console.error("MUSE.AI: 渲染过程中发生异常:", error);
      rootElement.innerHTML = `
        <div style="background: #020617; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;">
          <h2 style="color: #ef4444; margin-bottom: 10px;">应用渲染异常</h2>
          <p style="color: #94a3b8; font-size: 14px;">错误详情: ${error.message}</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">请检查 src 目录下是否存在 WardrobeApp.jsx 文件且文件名拼写正确。</p>
        </div>
      `;
    }
  } else {
    console.error("致命错误：HTML 页面中未找到 id 为 'root' 的挂载点。");
  }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startApp();
} else {
  document.addEventListener('DOMContentLoaded', startApp);
}