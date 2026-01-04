import React from 'react';
import ReactDOM from 'react-dom/client';

/**
 * 导入主应用组件
 * * 注意：在某些部署环境（如 Vercel）或 Canvas 预览中，
 * 如果文件由于路径嵌套或后缀名解析配置导致无法识别，
 * 编译器会报错。
 * * 修复策略：
 * 1. 尝试使用不带扩展名的导入方式（Vite 默认支持）。
 * 2. 检查渲染挂载点是否存在。
 */

// 尝试去掉后缀名，让构建工具自动识别 .jsx 或 .js
import App from './WardrobeApp';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React 渲染失败:", error);
    rootElement.innerHTML = `
      <div style="background: #1e293b; color: white; padding: 2rem; border-radius: 1rem; text-align: center;">
        <h2 style="margin-bottom: 1rem;">应用加载失败</h2>
        <p style="color: #94a3b8; font-size: 0.875rem;">请检查 WardrobeApp.jsx 文件是否存在于 main.jsx 相同的目录下。</p>
      </div>
    `;
  }
} else {
  console.error("致命错误：HTML 页面中缺少 id 为 'root' 的元素。");
}