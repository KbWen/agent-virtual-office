import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { locale } from './i18n'
import './index.css'

document.documentElement.lang = locale()

// Global error handlers — catch async errors that escape React ErrorBoundary
window.addEventListener('unhandledrejection', (e) => {
  console.warn('[Office] Unhandled promise rejection:', e.reason)
})

window.addEventListener('error', (e) => {
  // Only log non-script errors (script errors are already in console)
  if (e.error && !e.filename) {
    console.warn('[Office] Uncaught error:', e.error)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
