import React from 'react';
import ReactDOM from 'react-dom';

/**
 * 导入主应用组件
 * * 修复策略：
 * 1. 路径修复：移除显式的 .jsx 后缀。在某些 esbuild/Vite 环境中，
 * 默认配置会自动处理文件扩展名，显式添加有时反而会触发路径匹配失败。
 * 2. 容错处理：维持稳定渲染，使用 ReactDOM.render 避开 React 18 的底层 Dispatcher 冲突。
 */

import App from './WardrobeApp';

// 获取 HTML 中的根挂载点
const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    // 强制清空容器，防止 React 17/18 状态冲突
    rootElement.innerHTML = '';

    console.log("MUSE.AI: 正在尝试加载 WardrobeApp 组件...");

    // 使用兼容性模式渲染
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      rootElement
    );

    console.log("MUSE.AI: 应用启动指令已发送");
  } catch (error) {
    console.error("MUSE.AI 启动异常:", error);
    rootElement.innerHTML = `
      <div style="background: #0f172a; color: #f87171; padding: 40px; border-radius: 24px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; margin: 20px;">
        <h2 style="margin-bottom: 16px;">主组件渲染失败</h2>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px;">
          无法正确解析 <b>WardrobeApp</b>。请确认该文件在项目根目录且没有语法错误。
        </p>
        <pre style="background: #020617; padding: 16px; border-radius: 12px; font-size: 11px; text-align: left; overflow-x: auto; border: 1px solid #334155; color: #ef4444;">${error.message}</pre>
        <button onclick="window.location.reload()" style="margin-top: 24px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">重试</button>
      </div>
    `;
  }
} else {
  console.error("MUSE.AI: 找不到挂载点 #root");
}