import { Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/layout/Header'
import ReloadPrompt from '@/components/ReloadPrompt'

// Routen werden lazy geladen – schwere Abhängigkeiten (PDF, OCR, Charts)
// landen damit nicht mehr im initialen Bundle.
const HomePage = lazy(() => import('@/pages/HomePage'))
const AufmassPage = lazy(() => import('@/pages/AufmassPage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))

function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
      <div className="animate-pulse text-muted-foreground text-sm">Lädt…</div>
    </div>
  )
}

function App() {
  const location = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-transparent">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/aufmass" element={<AufmassPage />} />
              <Route path="/admin/aufmass" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </main>
      <Toaster />
      <ReloadPrompt />
    </div>
  )
}

export default App
