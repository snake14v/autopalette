/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/index.html',
    './admin/index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#c5a44e',
        goldBright: '#e8c96e',
        neonGold: '#ffd700',
        char: '#0a0a0a',
        char2: '#0f0f0f',
        char3: '#141414',
        pinstripe: {
          cyan: '#00e5ff',
          magenta: '#ff00d4',
          emerald: '#00ff88',
          red: '#ff1a1a',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        ui: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
