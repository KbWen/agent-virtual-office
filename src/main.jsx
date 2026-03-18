import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { locale } from './i18n'
import './index.css'

document.documentElement.lang = locale()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
