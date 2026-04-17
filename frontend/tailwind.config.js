/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8faff',
        surface: '#ffffff',
        primary: '#6366f1',
        'primary-soft': '#eef2ff',
        accent: '#06b6d4',
        'accent-soft': '#ecfeff',
        soft: '#f1f5f9',
        muted: '#94a3b8',
        border: '#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(99, 102, 241, 0.08)',
        'orb': '0 20px 80px rgba(99, 102, 241, 0.25), 0 4px 24px rgba(99, 102, 241, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(99, 102, 241, 0.08)',
        'elevated': '0 4px 16px rgba(0,0,0,0.06), 0 16px 48px rgba(99, 102, 241, 0.12)',
        'bubble': '0 2px 12px rgba(99, 102, 241, 0.1)',
      },
      backgroundImage: {
        'page': 'linear-gradient(145deg, #f8faff 0%, #eef2ff 40%, #e0f2fe 100%)',
        'orb-idle': 'radial-gradient(circle at 35% 35%, #a5b4fc, #6366f1 50%, #4f46e5)',
        'orb-listening': 'radial-gradient(circle at 35% 35%, #67e8f9, #06b6d4 50%, #0891b2)',
        'orb-thinking': 'radial-gradient(circle at 35% 35%, #c4b5fd, #a78bfa 50%, #7c3aed)',
        'orb-speaking': 'radial-gradient(circle at 35% 35%, #818cf8, #6366f1 50%, #4338ca)',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}
