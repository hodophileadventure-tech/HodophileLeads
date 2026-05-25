import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
    ,
    // Temporarily disable HMR to stop continuous reloads while debugging
    hmr: false,
    watch: {
      // Ignore build outputs and backend files to avoid infinite reload loops
      ignored: ['**/dist/**', '**/build/**', '../backend/**', '**/node_modules/**']
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
