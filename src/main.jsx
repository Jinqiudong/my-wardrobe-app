import React from 'react';
import ReactDOM from 'react-dom';

// --- DEBUG LOG ---
console.log("DEBUG: main.jsx 已被浏览器加载");

/**
 * 导入主应用组件
 * 修复说明：
 * 之前的代码尝试从 './WardrobeApp' 导入，但根据你的文件列表，
 * 主组件的文件名实际上是 'App.jsx'。
 * 现已修正为 './App' 以解决无法解析路径的错误。
 */
import App from './App';

// 获取 HTML 中的根挂载点
const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    console.log("DEBUG: 准备执行 ReactDOM.render...");

    // 强制清除旧内容
    rootElement.innerHTML = '';

    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      rootElement
    );

    console.log("DEBUG: ReactDOM.render 执行完毕");
  } catch (error) {
    console.error("DEBUG: main.jsx 渲染阶段报错:", error);
    rootElement.innerHTML = `
      <div style="color:white;padding:20px;background:#1e293b;border-radius:12px;margin:20px;font-family:sans-serif;">
        <h3 style="color:#f87171;">渲染错误</h3>
        <pre style="font-size:12px;color:#94a3b8;white-space:pre-wrap;">${error.message}</pre>
      </div>
    `;
  }
} else {
  console.error("DEBUG: 找不到挂载点 #root");
}