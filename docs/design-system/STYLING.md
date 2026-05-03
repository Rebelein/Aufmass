# Styling, Theme & CSS-Regeln

Das Design der App wurde von veralteten, hardcodierten "Glassmorphism"-Klassen (z.B. `.glass-card`, `bg-white/10`) bereinigt und nutzt nun **semantische Tailwind CSS v4 Tokens**. 

Dadurch ist die App konsistent, barrierefrei und zukunftssicher (z.B. für sofortigen Light/Dark Mode Support).

## 1. Semantische Farb-Tokens

Nutze NIEMALS fixe Farbwerte für Layout-Elemente (wie `bg-gray-800` oder `bg-white`). Nutze immer semantische Variablen, die sich an das System-Theme anpassen:

*   **`bg-background`**: Der äußerste Hintergrund der App.
*   **`bg-card`**: Der Hintergrund von Kacheln, Containern und Modalen. Bietet oft leichten Kontrast zum Background.
*   **`text-foreground`**: Die Standard-Textfarbe (Weiß im Darkmode, Schwarz im Lightmode).
*   **`text-muted-foreground`**: Für Nebensächliches, Untertitel, Meta-Daten (Grauton).
*   **`bg-muted`**: Für subtile Hintergründe (z.B. inaktive Tabs, Eingabefelder).
*   **`border-border`** / **`border-input`**: Standard-Rahmenfarben (dezente Linien).
*   **`bg-primary`**: Die Haupt-Akzentfarbe (in unserem Fall ein Emerald-Grün). Wird für primäre Buttons genutzt.
*   **`text-primary-foreground`**: Die Textfarbe *auf* einem primären Hintergrund (meistens dunkler Text auf hellem Grün, um Kontrast zu garantieren).
*   **`bg-destructive`**: Für fehlerhafte oder kritische Aktionen (z.B. Löschen-Button, Rot).

## 2. Abstände, Radien und Schatten

Wir nutzen eine moderne "SaaS"-Ästhetik. Das bedeutet:
*   **Abgerundete Ecken:** Großzügige Radien machen das Interface weicher. Wir nutzen häufig `rounded-xl` für Standard-Karten, `rounded-2xl` oder `rounded-3xl` für Hero-Sektionen oder große Container.
*   **Schatten:** Schatten schaffen Tiefe und trennen Ebenen (Z-Index).
    *   `shadow-sm` für Standard-Karten.
    *   `shadow-md` oder `shadow-lg` bei Hover-Effekten.
*   **Paddings (Abstände):** Viel Whitespace. Elemente sollen "atmen". Karten erhalten oft `p-4` bis `p-6`.

## 3. Tailwind v4 Konfiguration (`index.css`)

In Tailwind v4 wird die Konfiguration via CSS-Variablen im `@theme`-Block direkt in der CSS-Datei vorgenommen.

```css
@theme {
  --font-family-sans: 'Inter', sans-serif;
  
  /* Semantische Farben */
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... weitere Farben ... */

  /* Eigene Keyframes für Wow-Effekte */
  @keyframes shine {
    from { background-position: 200% center; }
    to { background-position: -200% center; }
  }
}

/* Base Layer: Definition der HSL Variablen */
@layer base {
  :root {
    --background: 0 0% 100%;
    /* ... Lightmode Werte ... */
  }
  .dark {
    --background: 224 71% 4%; /* Dunkelblau/Schwarz */
    --card: 222 47% 11%;
    /* ... Darkmode Werte ... */
  }
}
```

## 4. Don'ts (Was zu vermeiden ist)

*   **Keine hardcodierte Opazität für Layouts:** Nutze nicht `bg-white/5` oder `bg-black/20` für generelle Karten-Hintergründe. Das bricht im Lightmode. Verwende stattdessen `bg-card` oder `bg-muted`.
*   **Keine Custom CSS-Klassen für UI-Elemente:** Erstelle keine Klassen wie `.my-custom-button` im CSS. Nutze Tailwind-Utilities im JSX (`className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"`). Wenn du eine Komponente oft brauchst, baue eine React-Komponente (z.B. `<Button variant="primary">`).