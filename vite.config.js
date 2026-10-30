import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleOcr } from './server/ocrHandler.js'

// Serves POST /api/ocr from the dev/preview server so the OpenAI key stays server-side.
const ocrApi = (env) => ({
  name: 'ocr-api',
  configureServer(server) {
    server.middlewares.use('/api/ocr', (req, res) => handleOcr(req, res, env))
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/ocr', (req, res) => handleOcr(req, res, env))
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // all vars incl. non-VITE_ ones (never sent to browser)
  return {
    plugins: [react(), ocrApi(env)],
    server: {
      port: 5175,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
            pdf: ['jspdf', 'html2canvas']
          }
        }
      }
    }
  }
})
