import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodic check for updates every minute (for development phase)
      if (r) {
        setInterval(() => {
          r.update()
        }, 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5">
      <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-5 flex flex-col gap-4">
        <div className="text-sm font-medium text-gray-800">
          {offlineReady ? (
            <span>Die App ist nun bereit offline zu arbeiten.</span>
          ) : (
            <span>Eine neue Version ist verfügbar. Bitte aktualisieren, um die neuen Funktionen zu laden.</span>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
            onClick={() => close()}
          >
            Schließen
          </button>
          {needRefresh && (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              onClick={() => updateServiceWorker(true)}
            >
              Aktualisieren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReloadPrompt