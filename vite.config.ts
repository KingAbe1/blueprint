import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STORE_FILE = path.resolve(__dirname, '.blueprint_store.json')

function projectPersistencePlugin(): Plugin {
  return {
    name: 'project-persistence',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/projects') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            if (fs.existsSync(STORE_FILE)) {
              try {
                const data = fs.readFileSync(STORE_FILE, 'utf-8').trim()
                if (data) {
                  res.end(data)
                  return
                }
              } catch (e) {
                console.error('Failed to read .blueprint_store.json', e)
              }
            }
            res.end(JSON.stringify([]))
            return
          }
          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body)
                fs.writeFileSync(STORE_FILE, JSON.stringify(parsed, null, 2), 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 0 }))
              } catch (err) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }))
              }
            })
            return
          }
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    projectPersistencePlugin(),
  ],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/.blueprint_store.json', '**/.blueprint_store.json*']
    }
  }
})

