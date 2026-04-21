import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SyncProvider } from './hooks/use-sync-status'
import { SyncIndicator } from './components/SyncIndicator'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SyncProvider>
        <App />
        <SyncIndicator />
      </SyncProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
