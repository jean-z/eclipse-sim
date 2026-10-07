import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 5175 端口：避开 5173（Solar-Wanderer）与 5174（deep-sea）
export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
})
