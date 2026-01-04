import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './WardrobeApp.jsx';

// 寻找挂载点
const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);

    // 渲染主组件
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    console.log("MUSE.AI: 系统启动成功");
  } catch (error) {
    // 渲染失败时的 UI 反馈
    rootElement.innerHTML = `
      <div style="background: #0f172a; color: #f87171; padding: 40px; border-radius: 24px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; margin: 20px;">
        <h2 style="margin-bottom: 16px;">React 渲染失败</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          这通常是由于组件内部存在运行时错误，或者文件导入路径不正确。
        </p>
        <pre style="background: #020617; padding: 16px; border-radius: 12px; font-size: 12px; text-align: left; overflow-x: auto; margin-top: 20px; border: 1px solid #334155;">${error.stack}</pre>
        <button onclick="window.location.reload()" style="margin-top: 24px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          重试加载
        </button>
      </div>
    `;
  }
} else {
  console.error("MUSE.AI: 错误！index.html 中找不到 id='root' 的元素。");
}