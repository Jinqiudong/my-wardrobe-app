/**
 * Gemini AI 服务模块
 * 处理图像识别和穿搭建议逻辑
 */

const getEnv = (key) => {
  try {
    return import.meta.env[`VITE_${key}`] || import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const API_KEY = getEnv('GEMINI_API_KEY');
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

/**
 * 模拟 AI 识别单品逻辑
 * 在实际应用中，这里会发送 Base64 图片数据给 Gemini
 */
export const analyzeClothingImage = async (base64Image) => {
  if (!API_KEY || API_KEY === '你的_GEMINI_API_KEY') {
    throw new Error('未配置 Gemini API Key');
  }

  // 这里封装具体的 API 请求逻辑
  // 暂时返回模拟结果
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        category: '上装',
        name: '白色亚麻衬衫',
        color: '白色',
        tags: ['休闲', '夏季', '透气']
      });
    }, 2000);
  });
};

/**
 * 生成穿搭建议
 */
export const getOutfitRecommendation = async (weather, items) => {
  // 构造 Prompt
  const prompt = `当前天气：${weather.temp}度，${weather.condition}。
  我有以下衣物：${items.map(i => i.name).join(', ')}。
  请为我推荐一套最合适的穿搭，并说明理由。`;

  // 实际调用逻辑...
  return "建议穿着：白色亚麻衬衫 + 牛仔裤。理由：今日气温较高，亚麻材质透气舒适。";
};