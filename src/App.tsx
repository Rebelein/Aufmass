import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/layout/Header'
import HomePage from '@/pages/HomePage'
import AufmassPage from '@/pages/AufmassPage'
import AdminPage from '@/pages/AdminPage'
import ReloadPrompt from '@/components/ReloadPrompt'

function App() {
  const location = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-background">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/aufmass" element={<AufmassPage />} />
            <Route path="/admin/aufmass" element={<AdminPage />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Toaster />
      <ReloadPrompt />
    </div>
  )
}

export default App
