/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'damage-popup': 'damagePopup 1s ease-out forwards',
      },
      keyframes: {
        damagePopup: {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) translateY(0)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) translateY(-30px)' },
        },
      },
    },
  },
  plugins: [],
}
