import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { tuningSavePlugin } from './vite-plugins/tuning-save-plugin'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'serve' ? [tuningSavePlugin()] : []),
  ],
  base: '/RogueliteCommandBattleJS/',
  // MPA設定: エディタページをSPA fallbackで上書きさせない
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
}))
