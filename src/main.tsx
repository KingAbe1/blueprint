import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { markDesktopAppShell } from './utils/platform'
import { bootstrapTheme } from './utils/themeBootstrap'
import { installNotificationDevHarness } from './utils/notificationDevHarness'

markDesktopAppShell()
installNotificationDevHarness()

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root was not found')
}

void bootstrapTheme().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
