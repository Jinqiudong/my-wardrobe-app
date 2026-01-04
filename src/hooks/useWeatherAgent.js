import { useState, useEffect } from 'react';

/**
 * Weather Agent Hook
 * 职责：
 * 1. 感知地理位置
 * 2. 抓取实时气象数据
 * 3. 将数据格式化为 Agent 汇报语
 */
export const useWeatherAgent = () => {
  const [weatherData, setWeatherData] = useState({
    temp: '--',
    condition: '正在感知...',
    city: '定位中',
    wind: '--',
    humidity: '--',
    report: 'Weather Agent 正在初始化...'
  });

  const [loading, setLoading] = useState(true);

  const fetchWeather = async (lat, lon) => {
    try {
      // 使用 Open-Meteo API (无需 Key)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      const response = await fetch(url);
      const data = await response.json();

      const codes = {
        0: '晴朗', 1: '晴间多云', 2: '多云', 3: '阴天',
        45: '雾', 48: '沉积雾', 51: '毛毛雨', 61: '小雨',
        71: '小雪', 95: '雷阵雨'
      };

      const current = data.current;
      const condition = codes[current.weather_code] || '多云';
      const temp = Math.round(current.temperature_2m);

      // 生成给主大脑汇报的文本
      const agentReport = `[Weather Agent 汇报]:
      当前位置坐标为 (${lat.toFixed(2)}, ${lon.toFixed(2)})。
      气温 ${temp}°C，天气状况为${condition}。
      湿度 ${current.relative_humidity_2m}%，风速 ${current.wind_speed_10m}km/h。
      建议：${temp < 15 ? '天气较凉，建议搭配外套。' : '气温适宜，适合轻便穿搭。'}`;

      setWeatherData({
        temp,
        condition,
        city: '当前位置',
        wind: current.wind_speed_10m,
        humidity: current.relative_humidity_2m,
        report: agentReport
      });
    } catch (error) {
      setWeatherData(prev => ({ ...prev, report: '[Weather Agent Error]: 无法连接到气象卫星。' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => {
          setWeatherData(prev => ({ ...prev, report: '[Weather Agent]: 用户拒绝定位权限，使用默认气象参数。' }));
          setLoading(false);
        }
      );
    }
  }, []);

  return { ...weatherData, loading };
};