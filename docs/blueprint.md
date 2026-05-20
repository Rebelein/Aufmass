# Projekt Blueprint: Rebelein Aufmaß-App

## 1. Projekt-Status (Stand: April 2026)
Die Anwendung ist eine spezialisierte **Aufmaß- und Dokumentations-Lösung** für Handwerksbetriebe. Sie ermöglicht die Erfassung von Materialien auf Baustellen, den Abgleich mit Großhändler-Daten (Datanorm) und den Export als PDF oder CSV.

### Kern-Features:
*   **Projekt-Management:** Erstellung und Verwaltung von Baustellen/Projekten.
*   **Intelligentes Aufmaß:** Schnelle Erfassung von Artikeln in verschiedenen Bauabschnitten.
*   **PDF/CSV-Import (OCR):** Lokaler Import von LVs oder Listen via Texterkennung (Tesseract.js) mit automatischem Datanorm-Abgleich.
*   **Datanorm-Suche:** Globaler Zugriff auf Millionen von Großhändler-Artikeln via Suchmaske.
*   **Offline-First:** Lokale Zwischenspeicherung der Daten mit Hintergrund-Synchronisation zu Supabase.
*   **Self-Hosted:** Vollständige Kontrolle durch Betrieb auf eigenem vServer.

---

## 2. Wichtige Verzeichnisse & Ressourcen

### 🗄️ Datenbank (Supabase / Postgres)
Alle Informationen zur Datenbankstruktur befinden sich hier:
*   **`supabase/schema_current.sql`**: Das tagesaktuelle, vollständige Datenbankschema (Referenz).
*   **`supabase/migrations/`**: Enthält die initiale Baseline-Migration für neue Setups.
*   **`src/lib/supabase.ts`**: Konfiguration der Datenbank-Verbindung.

### 🎨 Design & UI
Richtlinien für das visuelle Erscheinungsbild:
*   **`docs/design-system/`**: Enthält alle aktuellen Design-Vorgaben, Farbpaletten und UI-Komponenten-Regeln.
*   **`src/components/ui/`**: Die Basis-Bausteine der Oberfläche (Buttons, Dialoge, Inputs).
*   **`tailwind.config.ts`**: Konfiguration des CSS-Frameworks.

### 🚀 Logik & Features
Wo passiert was?
*   **`src/lib/catalog-storage.ts`**: Logik für Katalog-Artikel und Datanorm-Suche.
*   **`src/lib/project-storage.ts`**: Verwaltung von Projekten und Aufmaß-Positionen.
*   **`src/components/dialogs/ProjectImportDialog.tsx`**: Das Herzstück des OCR- und PDF-Imports.
*   **`docs/superpowers/`**: Detaillierte Konzepte zu speziellen Funktionen wie KI-Management.

---

## 3. Tech-Stack
*   **Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS (Modernes Dark/Light-Design)
*   **Datenbank:** PostgreSQL (Self-hosted via Supabase/Coolify)
*   **OCR:** Tesseract.js (Lokale Texterkennung im Browser)
*   **Hosting:** Linux vServer via Coolify

---

## 4. API & Integrationen
*   **Datanorm-Import:** Erfolgt über ein optimiertes Massen-Upload-Tool im Admin-Bereich direkt in die `articles`-Tabelle (Source: 'wholesale').
*   **Gemini AI:** Integriert für zukünftige intelligente Assistenzfunktionen (API-Key in `.env`).
