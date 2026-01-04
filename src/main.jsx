import React from 'react';
import ReactDOM from 'react-dom';

/**
 * 导入主应用组件
 * * 修复策略：
 * 1. 路径修复：尝试移除 .jsx 后缀。在某些构建环境下，
 * 默认的文件查找逻辑会自动处理扩展名，显式指定反而会导致解析失败。
 * 2. 兼容性维持：继续使用 ReactDOM.render 以避免 React 18 模式下的属性读取冲突。
 */

import App from './WardrobeApp';

// 获取 HTML 中的根挂载点
const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    // 强制清空容器，防止状态冲突
    rootElement.innerHTML = '';

    console.log("MUSE.AI: 正在尝试加载 WardrobeApp 组件...");

    // 使用兼容性模式渲染
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      rootElement
    );

    console.log("MUSE.AI: 应用启动成功");
  } catch (error) {
    console.error("MUSE.AI 启动异常:", error);
    rootElement.innerHTML = `
      <div style="background: #0f172a; color: #f87171; padding: 40px; border-radius: 24px; font-family: sans-serif; text-align: center; border: 1px solid #1e293b; margin: 20px;">
        <h2 style="margin-bottom: 16px;">主组件渲染失败</h2>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px;">
          无法从 <b>WardrobeApp</b> 载入内容。请检查文件名拼写和路径。
        </p>
        <pre style="background: #020617; padding: 16px; border-radius: 12px; font-size: 11px; text-align: left; overflow-x: auto; border: 1px solid #334155; color: #ef4444;">${error.message}</pre>
        <button onclick="window.location.reload()" style="margin-top: 24px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">重试</button>
      </div>
    `;
  }
} else {
  console.error("MUSE.AI: 找不到挂载点 #root");
}