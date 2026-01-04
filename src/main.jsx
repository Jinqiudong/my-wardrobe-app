import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * 导入主应用组件
 * * 修复说明：
 * 如果编译器持续报错找不到文件，通常是因为：
 * 1. 文件名大小写不匹配（Linux/Vercel 环境对大小写极其敏感）。
 * 2. 文件未在正确的目录下。
 * * 这里我将恢复带后缀的导入并增加容错逻辑。
 */
import App from './WardrobeApp.jsx';

// 获取 HTML 中的挂载点
const rootElement = document.getElementById('root');

const initApp = () => {
  if (rootElement) {
    try {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    } catch (error) {
      console.error("React 渲染过程中发生异常:", error);
      rootElement.innerHTML = `
        <div style="background: #020617; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif;">
          <div style="text-align: center; padding: 20px; border: 1px solid #1e293b; rounded: 12px;">
            <p>应用启动失败</p>
            <p style="font-size: 12px; color: #64748b;">请检查控制台获取详细错误堆栈</p>
          </div>
        </div>
      `;
    }
  } else {
    console.error("致命错误：无法在 index.html 中定位到 id 为 'root' 的挂载点。");
  }
};

// 确保在 DOM 加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}