
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

function showFatalError(message) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 16px; border: 1px solid #cc0000; background: #fff3f3; color: #7a0000;">
      <h2 style="margin-top: 0;">Error en el frontend</h2>
      <pre style="white-space: pre-wrap; margin: 0;">${message}</pre>
    </div>
  `
}

window.addEventListener('error', (event) => {
  const base = event?.error?.message || event?.message || 'Error desconocido'
  const stack = event?.error?.stack || ''
  const msg = stack ? `${base}\n\n${stack}` : base
  showFatalError(msg)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  const msg = (reason && (reason.stack || reason.message)) || String(reason || 'Promesa rechazada')
  showFatalError(msg)
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
