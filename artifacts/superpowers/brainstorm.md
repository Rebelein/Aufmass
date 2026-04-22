## Goal
Erweiterung der Aufmaß-App um erweiterte Status- und Workflow-Logik (Übernahme von Angebot in Aufmaß), Monteur-Kernfunktionen (Speech-to-Text, Info-Hub, Split-Screen Kopiermodus, Offline-Sync) sowie erweiterte Notiz- und Foto-Dokumentations-Funktionen.

## Constraints
- Die bestehende Supabase-Backend-Struktur und Echtzeit-Synchronisation muss beibehalten oder sanft erweitert werden.
- Speech-to-Text soll über die Google Cloud Speech-to-Text Realtime API laufen, um hohe Zuverlässigkeit und Geschwindigkeit zu gewährleisten.
- Kopiermodus muss auf Tablet-Bildschirmen gut bedienbar sein, wobei Artikelnamen, Mengen und Großhändler sichtbar bleiben. Ein Klick auf die Article Card kopiert die Artikelnummer.
- Offline-Fähigkeit (Hybrid-Sync) erfordert lokales Caching von Änderungen via IndexedDB/localStorage oder Service Worker (Workbox Background Sync).
- Erweiterte Zeichenfunktion: Freihand-Notizen auf leeren Blättern und auf bestehenden/neuen Fotos.

## Known context
- App verwendet React, Vite, TailwindCSS, Supabase.
- PWA-Konfiguration mit `vite-plugin-pwa` und Workbox ist bereits aktiv.
- Projekte haben einen Status (`status: 'planning' | 'active' | 'completed'`).
- `ProjectSelectedItem` speichert Artikel im Aufmaß/Angebot. Aktuell wird vermutlich nicht unterschieden, ob sie aus dem Angebot ins Aufmaß überführt wurden.

## Risks
- **Speech-to-Text API-Kosten/Latenz:** Google Cloud API erfordert Authentifizierung (z.B. via Supabase Edge Function oder Token) und verursacht Kosten. Latenz muss gering gehalten werden.
- **Offline-Sync Komplexität:** Wenn App im Hintergrund geschlossen wird, bevor der Sync durch ist, könnten Daten verloren gehen.
- **Canvas-Komplexität:** Freihandzeichnen und Speichern der Bilder (als Base64 oder in Supabase Storage) erfordert sauberes State-Management.

## Options (2–4)
1. **Speech-to-Text:** Nutzung von Google Cloud Speech-to-Text (Streaming via WebSockets oder Audio-Chunks via REST/Supabase Function).
2. **Kopiermodus UI:** Ein Toggle-Button ändert das Verhalten der Article Card. Das Design bleibt informativ (Name, Menge, Händler bleiben sichtbar), aber die Card selbst wird zur großen Copy-Schaltfläche (visuelles Feedback bei Klick).
3. **Notiz-Funktion:** Integration eines HTML5-Canvas (z.B. mit `react-signature-canvas` oder nativem Canvas-Code), der es erlaubt, sowohl auf einem weißen Hintergrund als auch über einem Foto zu zeichnen und das Ergebnis im Projekt zu speichern.

## Recommendation
- **Workflow & Status:** Beim Statuswechsel von 'planning' auf 'active' werden die Items dupliziert oder markiert (Feld `is_from_angebot: boolean` in der DB ergänzen).
- **Speech-to-Text:** Integration der Google Cloud Speech-to-Text API (via Edge Function Proxy aus Sicherheitsgründen) für schnelle und präzise Branchen-Erkennung.
- **Split-Screen / Kopiermodus:** Die Article Card bekommt einen "Copy Mode". Wenn aktiv, ändert sich der Klick-Bereich der Karte so, dass die Artikelnummer kopiert wird, ohne dass Name oder Menge ausgeblendet werden.
- **Offline-Sync:** Custom lokale Action-Queue (`localStorage`) kombiniert mit Zustand. Wenn `navigator.onLine` false ist, werden Mutations (Upserts) lokal in der Queue gespeichert und bei Reconnect gegen Supabase abgearbeitet.
- **Notiz & Foto-Markup:** Implementierung eines modalen Zeichen-Editors. Benutzer kann wählen: "Neues Foto machen", "Foto auswählen" oder "Leeres Notizblatt". Auf dem resultierenden Hintergrund kann gezeichnet und das Ergebnis als Base64-String oder Storage-Datei an das `ProjectSelectedItem` oder das Projekt gehangen werden.

## Acceptance criteria
- [ ] Beim Wechsel eines Projekts auf "Laufend" werden bestehende Positionen im Aufmaß visuell als "aus Angebot" markiert, bleiben aber editierbar.
- [ ] Monteur kann über ein Mikrofon-Icon Text einsprechen (via Google Cloud API), der live angezeigt und als Suche genutzt wird.
- [ ] Kopiermodus-Ansicht kann über einen Button aktiviert werden; Klick auf die Article Card kopiert die Artikelnummer, alle wichtigen Infos bleiben sichtbar.
- [ ] App erkennt Offline-Modus, zeigt einen Indikator ("Offline"), speichert Änderungen lokal und synct diese automatisch bei erneuter Verbindung.
- [ ] Dokumente (PDFs, Bilder) können pro Projekt hinterlegt und im "Info-Hub" abgerufen werden.
- [ ] Benutzer können auf Fotos Skizzen anlegen oder ein leeres Notizblatt (Whiteboard) öffnen, bemalen und im Projekt speichern.