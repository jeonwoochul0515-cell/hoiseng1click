import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * 로컬 개발용 프록시 설정.
 * 프론트에서 '/api/*'로 호출하면 Firebase Functions로 프록시되어 CORS를 우회합니다.
 * 프로덕션 빌드에서는 이 프록시가 동작하지 않으므로 실제 절대 URL을 사용해야 합니다.
 */
const FUNCTIONS_TARGET = 'https://api-m5vtpzqugq-du.a.run.app'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: FUNCTIONS_TARGET,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['lucide-react'],
        },
      },
    },
  },
})
