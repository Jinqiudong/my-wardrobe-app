/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        // 自定义 MUSE.AI 专属配色
        slate: {
          950: '#020617',
        },
      },
      animation: {
        // 增加自定义动画，配合代码中的 animate-in 使用
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in-bottom': 'slideInBottom 0.7s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInBottom: {
          '0%': { transform: 'translateY(1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        '3xl': '64px',
      },
    },
  },
  plugins: [],
}