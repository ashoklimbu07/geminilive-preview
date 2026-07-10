import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Forwards browser console.log/error calls to this terminal via a dev-only endpoint.
function terminalLogger() {
  return {
    name: 'terminal-logger',
    configureServer(server) {
      server.middlewares.use('/__client-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const { level, args } = JSON.parse(body)
            const prefix = level === 'error' ? '[browser:error]' : '[browser]'
            console.log(prefix, ...args)
          } catch {
            // ignore malformed payloads
          }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), terminalLogger()],
})
