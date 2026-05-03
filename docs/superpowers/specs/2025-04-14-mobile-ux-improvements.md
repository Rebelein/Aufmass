# Aufmass Mobile UX Verbesserungsplan
> **Szenario:** Monteure auf der Baustelle - Smartphone-Nutzung mit Arbeits Handschuhen, Sonnenlicht, Zeitdruck

## Ziel
Materialerfassung in unter 30 Sekunden für häufige Artikel. Minimale Interaktionen, maximale Sichtbarkeit, robust gegen Umgebungsbedingungen.

---

## Phase 1: Katalog-Navigation optimieren

### 1.1 Bottom Sheet statt Sidebar
**Problem:** Sidebar ist versteckt, erfordert extra Tap zum Öffnen
**Lösung:** Kategorien als von unten ausfahrendes Bottom Sheet (Material Design Pattern)

```
┌─────────────────────────┐
│  Projekt: Bad Renovierung │
│  ─────────────────────  │
│  Kategorie: Rohre       │  ← Aktueller Pfad
│  ─────────────────────  │
│  ┌─────┐ ┌─────┐ ┌─────┐│
│  │ Rohr│ │Fit- │ │Ven- ││  ← Artikel-Grid
│  │ 15mm│ │ tig ││ til ││     groß, gut klickbar
│  │  5x │ │  3x ││  2x ││
│  └─────┘ └─────┘ └─────┘│
│                         │
├─────────────────────────┤
│ ▲ Rohre ▼  [Favoriten] │  ← Bottom Sheet Handle
└─────────────────────────┘
```

### 1.2 Flat-Kategorien für häufige Bereiche
**Problem:** Tiefe Hierarchie (z.B. Sanitär → Rohre → Stahl → DN15)
**Lösung:**
- "Quick Categories" - häufige Hauptkategorien direkt sichtbar
- Smart defaults: Erste Unterkategorie automatisch öffnen
- Kategorie-Pills horizontal scrollbar (Swipe-Geste)

### 1.3 Favoriten-System
**Problem:** Gleiche Kategorien immer wieder suchen
**Lösung:**
- Stern-Favoriten für Kategorien
- Favoriten-Tab im Bottom Sheet (erste Position)
- Zuletzt verwendete Kategorien merken

---

## Phase 2: Artikel-Auswahl beschleunigen

### 2.1 Touch-optimierte Mengeneingabe
**Problem:** Kleine +/- Buttons schwer treffbar
**Lösung:**
- Große Touch-Ziele (min. 48x48px nach Material Design)
- Long-Press für Schnellauswahl (1, 5, 10)
- Swipe-Aktionen (nach rechts = +1, nach links = -1)

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │  ╔═════════════════════╗  │  │
│  │  ║   Mapress C-Stahl    ║  │  │
│  │  ║       DN 15          ║  │  │
│  │  ║                      ║  │  │
│  │  ║    [-]   5   [+]     ║  │  │  ← Große Buttons
│  │  ║         ⬆            ║  │  │
│  │  ╚═════════════════════╝  │  │
│  └───────────────────────────┘  │
│   ← Wischen für mehr / weniger  │
└─────────────────────────────────┘
```

### 2.2 Direkt-Add ohne Staging
**Problem:** Staging-System (Vormerken → Hinzufügen) = 2 Schritte
**Lösung:**
- "Direkt hinzufügen"-Modus als Option
- Staging optional für große Mengen
- Konfigurierbar in Settings

### 2.3 Schnellmengen-Buttons
**Problem:** Mehrere Taps für Mengen > 1
**Lösung:**
- Quick-Add Buttons: [+1] [+5] [+10]
- Konfigurierbare Standardmengen
- Tap-Hold für Mengeneingabe

---

## Phase 3: Übersicht und Bestätigung

### 3.1 Sticky Header mit Projektinfo
**Problem:** Man weiß nicht, in welchem Projekt man ist
**Lösung:**
- Kompakter Header mit Projektname
- Artikel-Anzahl-Pill (z.B. "23 Artikel")
- Quick-Actions: Suche, Favoriten, PDF

### 3.2 Mini-Summary unten
**Problem:** Summary ist versteckt, erfordert Scroll
**Lösung:**
- Sticky Bottom Bar mit:
  - Anzahl ausgewählter Artikel
  - "Übernehmen"-Button
  - Ausklapp-Handle für vollständige Liste

```
┌─────────────────────────────────┐
│  Projekt: Bad Renovierung   23 │ │
├─────────────────────────────────┤
│  ... Artikel-Liste ...          │
│                                 │
├─────────────────────────────────┤
│ ▼ 3 neu ausgewählt  [Übernehmen]│ ← Sticky Bottom
└─────────────────────────────────┘
```

### 3.3 Haptic Feedback & Sound
**Problem:** Keine Bestätigung bei Aktionen
**Lösung:**
- Vibration bei Tap (konfigurierbar)
- Kurzer Sound bei Mengen-Änderung
- Deutliche Animation bei "Hinzugefügt"

---

## Phase 4: Umgebungsanpassung

### 4.1 Outdoor-Modus
**Problem:** Sonnenlicht macht Bildschirm schwer lesbar
**Lösung:**
- High-Contrast-Modus (dunkler Text auf weiß)
- Größere Schriftgrößen
- Reduzierte Animationen

### 4.2 Handschuh-Modus
**Problem:** Touch-Ziele zu klein für Handschuhe
**Lösung:**
- Extra-große Buttons (60x60px)
- Erhöhter Tap-Bereich
- Voice-Input als Alternative

### 4.3 Offline-First
**Problem:** Baustellen haben oft schlechtes Netz
**Lösung:**
- Katalog cachen
- Offline-Aufmaß möglich
- Auto-Sync bei Verbindung

---

## Implementierungsreihenfolge

### Sprint 1: Kritisch (Mobile Navigation)
1. Bottom Sheet für Kategorien (ersetzt Sidebar)
2. Vergrößerte Touch-Ziele (48px minimum)
3. Sticky Header mit Projektinfo
4. Direkt-Add Option (ohne Staging)

### Sprint 2: Wichtig (Effizienz)
1. Favoriten-System für Kategorien
2. Quick-Add Buttons [+1] [+5] [+10]
3. Mini-Summary Sticky Bottom
4. Haptic Feedback

### Sprint 3: Optimierung
1. Outdoor/High-Contrast Modus
2. Handschuh-Modus
3. Zuletzt verwendete Kategorien
4. Swipe-Gesten für Mengen

---

## Metriken für Erfolg

| Metrik | Aktuell | Ziel |
|--------|---------|------|
| Taps bis erstem Artikel | 4-5 | 2-3 |
| Zeit für 5 Artikel | ~60s | <30s |
| Touch-Fehlerquote | Hoch | <5% |
| Sichtbarkeit bei Sonne | Schlecht | Gut |
| One-Hand-Bedienung | 50% | 90% |

---

## Technische Anforderungen

- **Framework:** Bestehendes Next.js + React
- **Mobile-First:** Tailwind responsive breakpoints
- **Touch:** Touch events, haptic API
- **State:** Optimistic UI Updates
- **Performance:** Lazy loading für Kategorien
