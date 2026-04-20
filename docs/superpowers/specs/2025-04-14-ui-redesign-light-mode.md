# Aufmass UI Redesign - Clean Light Mode

> **Design-System für Handwerker-Anwendung mit hoher Lesbarkeit**

## Ziel

Umwandlung des dunklen Glassmorphism-Designs in ein helles, professionelles Design mit Emerald/Teal-Akzenten. Verbesserung von Lesbarkeit, Accessibility und Benutzerfreundlichkeit für deutsche Handwerker.

## Design-Entscheidungen

### Farbschema

**Primary:** Emerald (#10B981)  
**Secondary:** Teal (#14B8A6)  
**Background:** White/Off-white (#FAFAFA / #F8FAFC)  
**Surface:** White cards with subtle shadows  
**Text:** Slate-900 for headings, Slate-600 for body

### Begründung

- **Clean Light Mode** = Beste Lesbarkeit, auch bei Sonnenlicht
- **Emerald/Teal** = Behält Markenidentität, wirkt frisch und professionell
- **Subtile Schatten statt Glassmorphism** = Bessere Performance, klarere Struktur
- **Hohe Kontraste** = Erfüllt WCAG AA, gut für ältere Zielgruppe

## Architektur

### CSS-Variablen (globals.css)

```css
:root {
  /* Backgrounds */
  --background: 0 0% 98%;           /* #FAFAFA */
  --foreground: 222 47% 11%;        /* Slate-900 */
  
  /* Cards & Surfaces */
  --card: 0 0% 100%;                /* White */
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  
  /* Primary Accent */
  --primary: 160 84% 39%;           /* Emerald-500 */
  --primary-foreground: 0 0% 100%;  /* White */
  
  /* Secondary Accent */
  --secondary: 172 66% 50%;         /* Teal-500 */
  --secondary-foreground: 0 0% 100%;
  
  /* Muted Elements */
  --muted: 210 40% 96%;             /* Slate-100 */
  --muted-foreground: 215 16% 47%;  /* Slate-500 */
  
  /* Borders */
  --border: 214 32% 91%;            /* Slate-200 */
  --input: 214 32% 91%;
  --ring: 160 84% 39%;
  
  /* Destructive */
  --destructive: 0 84% 60%;         /* Red-500 */
  --destructive-foreground: 0 0% 100%;
  
  /* Radius */
  --radius: 0.75rem;
}
```

### Utility Classes

```css
/* Card mit Subtilem Schatten */
.card-flat {
  @apply bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200;
}

/* Button Primary */
.btn-primary-light {
  @apply bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200;
}

/* Button Secondary */
.btn-secondary-light {
  @apply bg-white hover:bg-slate-50 text-slate-700 font-medium px-6 py-2.5 rounded-lg border border-slate-200 shadow-sm hover:shadow active:scale-[0.98] transition-all duration-200;
}

/* Input Field */
.input-light {
  @apply bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 rounded-lg py-2.5 px-4 transition-all outline-none;
}
```

## Komponenten-Updates

### Navigation (layout.tsx)

**Sidebar (Desktop):**
- Weißer Hintergrund mit border-right
- Logo mit Emerald-Gradient
- Active-Link: Emerald background + bold text
- Hover: Subtle slate-100 background

**Mobile Navigation:**
- Weiße Bar mit shadow-top
- Active-Tab: Emerald icon + bold label
- Hover: Subtle background

### Cards (projects, article lists)

**Project Cards:**
- Weißer Hintergrund
- Subtle border (slate-200)
- Hover: Leichter Schatten-Lift
- Actions: Sichtbar, nicht versteckt

### Forms & Inputs

- Weiße Inputs mit slate-200 border
- Placeholder: slate-400 (nicht slate-300)
- Focus: Emerald ring
- Clear buttons, gut sichtbar

### Typography Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 | text-3xl | font-bold | slate-900 |
| H2 | text-2xl | font-semibold | slate-900 |
| H3 | text-xl | font-semibold | slate-800 |
| Body | text-base | font-normal | slate-700 |
| Small | text-sm | font-normal | slate-600 |
| Label | text-sm | font-medium | slate-600 |
| Caption | text-xs | font-medium | slate-500 |

**Minimum: text-sm (12px) - keine text-[10px] mehr**

## Accessibility Fixes

1. **Kontrast:** Alle Texte min. 4.5:1 Kontrast
2. **ARIA-Labels:** Für alle interaktiven Elemente
3. **Focus-States:** Sichtbare Outlines für Keyboard-Navigation
4. **Status:** Nicht nur Farbe, sondern auch Icons/Text
5. **Skip-Links:** Für Screenreader

## Anti-Patterns zu vermeiden

- ❌ Niedrige Opazität (text-white/30, text-white/40)
- ❌ backdrop-blur-xl Performance-Killer
- ❌ Versteckte Desktop-Actions
- ❌ text-[10px] zu kleine Schrift
- ❌ Farbonly-Status-Indikatoren
- ❌ Fehlende Active-States in Navigation

## Implementierungsreihenfolge

1. **globals.css** - Neue CSS-Variablen und Klassen
2. **layout.tsx** - Navigation mit Active-States
3. **projects/page.tsx** - Card-Styling
4. **aufmass/page.tsx** - Hauptworkflow
5. **Komponenten** - Alle Dialoge, Inputs, Buttons
6. **Cleanup** - Entferne ungenutzte Glassmorphism-Klassen

## Vorher/Nachher

| Aspekt | Vorher (Dark) | Nachher (Light) |
|--------|---------------|-----------------|
| Background | #0f172a (Dunkelblau) | #FAFAFA (Hell) |
| Cards | Glassmorphism blur | Weiß + shadow |
| Text | white/40-70 | slate-700-900 |
| Contrast | ~2:1 (fails WCAG) | 7:1+ (passes AAA) |
| Performance | backdrop-blur heavy | Flott |
| Outdoor | Schlecht lesbar | Gut lesbar |

## Design-Referenzen

- Linear.app - Clean Light Mode
- Notion.so - Subtle Shadows
- Vercel.com - Professional Dashboard
- shadcn/ui - Light Theme Defaults
