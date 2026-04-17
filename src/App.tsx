import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import Header from '@/components/layout/Header'
import HomePage from '@/pages/HomePage'
import ProjectsPage from '@/pages/ProjectsPage'
import AufmassPage from '@/pages/AufmassPage'
import AdminPage from '@/pages/AdminPage'
import ReloadPrompt from '@/components/ReloadPrompt'

function App() {
  const location = useLocation()
  const isAufmass = location.pathname === '/aufmass'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col gradient-mesh-bg">
      <Header />
      {/* AufmassPage gets full remaining height, no extra padding */}
      {isAufmass ? (
        <div className="flex-1 overflow-hidden">
          <AufmassPage />
        </div>
      ) : (
        <main className="flex-1 pb-20 md:pb-8">
          <div className="w-full py-6 md:py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/admin/aufmass" element={<AdminPage />} />
            </Routes>
          </div>
        </main>
      )}
      <Toaster />
      <ReloadPrompt />
    </div>
  )
}

export default App
