import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically, but less aggressively than 60s
        // and only trigger if there is a NEW service worker
        console.log('SW Registered');
        r.update();
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

  // Prevent showing the prompt if we just updated or if nothing is pending
  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-full animate-in slide-in-from-bottom-5">
      <div className="bg-background text-foreground border-border shadow-2xl rounded-2xl p-5 flex flex-col gap-4 backdrop-blur-xl border">
        <div className="text-sm font-medium text-foreground leading-relaxed">
          {offlineReady ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span>Die App ist nun bereit für den Offline-Betrieb.</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <span>Ein Update ist verfügbar! Möchtest du die App jetzt aktualisieren?</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-xl text-sm font-semibold transition-all"
            onClick={() => close()}
          >
            Später
          </button>
          {needRefresh && (
            <button
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              onClick={async () => {
                await updateServiceWorker(true);
              }}
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