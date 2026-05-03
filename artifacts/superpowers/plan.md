## Goal
Strukturierte Implementierung der neuen Workflow-Regeln (Angebots-Übernahme), Monteur-Funktionen (Google Cloud Speech-to-Text, Info-Hub, Kopiermodus, Offline-Queue) und einer erweiterten Foto-/Notiz-Zeichenfunktion.

## Assumptions
- Die Tabelle `project_items` kann um ein Feld (z.B. `is_from_angebot` boolean) erweitert werden.
- Die Tabelle `projects` hat bereits Status 'planning', 'active', 'completed'.
- Google Cloud Speech-to-Text erfordert ein Backend (z.B. Supabase Edge Function), um API-Schlüssel nicht dem Client auszusetzen.
- Freihand-Notizen werden als Base64 (oder im Supabase Storage) gespeichert.

## Plan

### Step 1: Datenbank-Schema für "Aus Angebot" anpassen
- **Files:** `supabase_migration_features.sql`, `src/lib/project-storage.ts`
- **Change:** Füge `is_from_angebot BOOLEAN DEFAULT false` zu `project_items` hinzu. Passe das Interface `ProjectSelectedItem` und `upsertProjectItem` in `project-storage.ts` an.
- **Verify:** Ausführen des SQL in Supabase. Prüfen ob TypeScript-Compiler fehlerfrei durchläuft.

### Step 2: Status-Übergang ("Laufend") & Visuelle Markierung
- **Files:** `src/pages/HomePage.tsx`, `src/pages/AufmassPage.tsx`, `src/components/aufmass/ArticleCard.tsx`
- **Change:**
  - In `HomePage.tsx` oder Projekt-Einstellungen: Wenn Status auf 'active' geändert wird, alle aktuellen `project_items` dieses Projekts mit `is_from_angebot = true` taggen (falls sie es noch nicht sind).
  - In `ArticleCard.tsx`: Wenn `is_from_angebot` true ist, ein kleines Badge ("Aus Angebot") anzeigen. Die Editierbarkeit (Menge ändern, löschen) bleibt ganz normal bestehen.
- **Verify:** Ein Projekt von "Planung" auf "Laufend" setzen. Im Aufmaß prüfen, ob die Artikel markiert sind und weiterhin Mengen geändert werden können.

### Step 3: Echtzeit Speech-to-Text (Cloud API)
- **Files:** `src/pages/AufmassPage.tsx`, `src/lib/speech-to-text.ts` (neu)
- **Change:** Implementierung eines Mikrofon-Buttons neben der Suchleiste. Aufnahme des Audios über `MediaRecorder`. Da API-Keys über `.env` sicher im Deployment-Prozess (Coolify) verwaltet werden, wird der direkte API-Aufruf (Google Cloud Speech-to-Text oder Gemini Audio-Processing, je nach Konfiguration) aus dem Client implementiert. Rückgabe des Transkripts füllt den `searchQuery` State in Echtzeit. Zeige einen pulsierenden Indikator während der Aufnahme.
- **Verify:** Mikrofon klicken, sprechen, prüfen ob Text schnell und zuverlässig im Suchfeld erscheint.

### Step 4: Split-Screen & Kopiermodus
- **Files:** `src/pages/AufmassPage.tsx`, `src/components/aufmass/ArticleCard.tsx`, `src/components/aufmass/SummaryList.tsx`
- **Change:** Toggle-Button ("Kopiermodus") hinzufügen. Wenn aktiviert, ändert sich das Styling der `ArticleCard` leicht, um Klickbarkeit zu suggerieren. Die Informationen (Name, Menge, Großhändler) bleiben unverändert sichtbar. Ein Klick auf die Karte (bzw. den Hauptbereich) kopiert die Artikelnummer in die Zwischenablage und löst ein haptisches und visuelles Feedback ("Kopiert!") aus.
- **Verify:** Modus umschalten, auf Karte klicken, prüfen ob Nummer kopiert wurde und UI Feedback gibt, während Infos sichtbar bleiben.

### Step 5: Technischer Informations-Hub
- **Files:** `src/pages/AufmassPage.tsx`, `src/lib/project-storage.ts`
- **Change:** Erweitere `projects` um `documents: string[]` oder erstelle eine UI im Aufmaß, in der verlinkte Dateien (z.B. in der Sidebar) abgerufen werden können. Da Dateiuploads komplex sind, zunächst eine einfache UI-Hülle in der Sidebar für Dokumente vorbereiten, um PDFs anzuzeigen.
- **Verify:** UI im Drawer aufrufen, Dokument-Dummy-Links öffnen.

### Step 6: Hybrid-Synchronisation (Offline-Light)
- **Files:** `src/lib/sync-queue.ts` (neu), `src/lib/project-storage.ts`, `src/pages/AufmassPage.tsx`
- **Change:** Einen Offline-Indikator im Header implementieren (`navigator.onLine`). Wenn offline, speichert `upsertProjectItem` Mutationen in einer Queue im `localStorage`. Wenn `window.addEventListener('online')` triggert, wird die Queue abgearbeitet und synchronisiert.
- **Verify:** Netzwerk im DevTools deaktivieren, Menge ändern (muss in UI bleiben), Netzwerk aktivieren, prüfen ob Speicherung in DB nachgeholt wird.

### Step 7: Freihand-Notizen und Foto-Markup
- **Files:** `src/pages/AufmassPage.tsx`, `src/components/dialogs/NoteEditorDialog.tsx` (neu)
- **Change:** Einen Button "Notiz / Foto" hinzufügen. Er öffnet ein Modal mit HTML-Canvas. Optionen: "Leeres Blatt", "Foto machen" oder "Foto hochladen". Das Foto wird als Hintergrund des Canvas geladen. Der Nutzer kann mit dem Finger/Stift zeichnen, Text schreiben oder radieren. Beim Speichern wird das Canvas als Base64-Bild generiert und dem aktuellen Abschnitt/Aufmaß als `ProjectSelectedItem` vom Typ `section` (mit Bild-URL) oder direkt am Projekt hinzugefügt.
- **Verify:** "Neues Blatt" öffnen, malen, speichern. Foto hochladen, darauf malen, speichern. Prüfen ob Bilder in der Übersicht auftauchen.

## Risks & mitigations
- **Speech API Setup:** Google Cloud API/Gemini erfordert korrekte Audio-Codierung und Chunking vom Browser aus. Mitigation: Ein sauberes Audio-Recording-Setup im Client aufbauen, welches direkt den API-Endpunkt anspricht (da Keys über `.env` sicher injiziert werden).
- Offline-Queue könnte verwaiste Zustände hinterlassen (z.B. Projekt gelöscht im Netz, aber lokale Updates). Mitigation: Queue verfällt oder prüft bei Sync, ob Projekt existiert.

## Rollback plan
- Wenn `is_from_angebot` Probleme bereitet, SQL Migration rückgängig machen (`ALTER TABLE project_items DROP COLUMN is_from_angebot`).
- Feature-Branches oder Rollback der Commits bei Fehlfunktionen der Queue.