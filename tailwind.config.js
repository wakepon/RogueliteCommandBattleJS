/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'damage-popup': 'damagePopup 2.25s ease-out forwards',
        'exp-blink': 'expBlink 0.8s ease-in-out infinite',
      },
      keyframes: {
        damagePopup: {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) translateY(0)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) translateY(-30px)' },
        },
        expBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}
