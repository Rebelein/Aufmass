# KI Integration Guide (Design System Replikation)

Dieses Dokument dient als **Prompt-Leitfaden** für KI-Agenten oder Entwickler, um dieses Design-System auf eine neue Komponente, eine neue Seite oder ein komplett neues Vite+React Projekt innerhalb des Rebelein-Ökosystems zu übertragen.

---

## 🤖 Prompt für den KI-Agenten

Wenn du einer KI die Anweisung gibst, neue Screens oder Apps im Rebelein-Stil zu bauen, kopiere den folgenden Block und übergib ihn der KI:

> **System-Anweisung: Rebelein Design-System Migration**
> 
> Du hast die Aufgabe, UI-Code für die Rebelein-Anwendung zu erstellen oder zu migrieren. Halte dich strikt an folgende Vorgaben für das Design-System:
> 
> 1. **Framework:** Nutze React mit Vite. Vermeide zwingend alle Next.js-spezifischen Imports (wie `next/image` oder `next/link`). Nutze `<Link>` aus `react-router-dom` für Navigation.
> 2. **Styling:** Nutze ausschließlich semantische Tailwind v4 CSS-Klassen. 
>    - Hintergründe: `bg-background`, `bg-card`, `bg-muted` (NIEMALS `bg-white/10` oder `bg-gray-800`).
>    - Textfarben: `text-foreground`, `text-muted-foreground`, `text-primary`.
>    - Rahmen: `border-border`.
>    - Radien: Nutze großzügige Radien (`rounded-xl`, `rounded-2xl`).
>    - Vermeide jegliche Custom-CSS-Klassen (wie `.glass-card` oder `.btn-primary`).
> 3. **Animationen:** Nutze `framer-motion` intensiv, aber subtil.
>    - Jede Hauptansicht muss mit einem leichten "Fade-Up" eingeblendet werden.
>    - Listen von Elementen müssen mit `staggerChildren` (Waterfall-Effekt) gerendert werden.
>    - Nutze `AnimatePresence` für alles, was im DOM gemountet/unmounted wird.
> 4. **"Wow-Effekte" (mvpblocks Stil):** Versuche das UI lebendig zu machen.
>    - Wenn es Metriken oder Zahlen gibt, wickle sie in eine `<MotionNumber>` Komponente ein.
>    - Wichtige, hervorgehobene Kacheln sollten in `<SpotlightCard>` gewickelt sein.
>    - Mache wichtige, primäre Aktions-Buttons magnetisch mit `<Magnetic>`.
>    - Nutze asymmetrische "Bento Grid" Layouts anstelle von monotonen Listen, wenn du Dashboards baust.
> 5. **Komponenten-Basis:** Nutze die bereitgestellten UI-Elemente aus `@/components/ui/` (basierend auf shadcn/ui). Nutze `<Button>`, `<Input>`, `<Dialog>` anstelle von rohen HTML-Tags.
> 
> Arbeite präzise, schreibe sauberen TypeScript Code und validiere immer, dass keine hardcodierten Dark-Mode-Farben die Light-Mode Funktionalität zerstören.

---

## 🛠 Checkliste für die manuelle Integration in ein neues Projekt

Wenn du dieses Design komplett in ein frisches Repo übernimmst, gehe so vor:

1. **Abhängigkeiten installieren:**
   ```bash
   npm i framer-motion lucide-react clsx tailwind-merge @radix-ui/react-*
   ```
2. **CSS übertragen:**
   Kopiere den Inhalt der `src/index.css` (inkl. des `@theme`-Blocks und der semantischen CSS-Variablen).
3. **Utility File kopieren:**
   Stelle sicher, dass `src/lib/utils.ts` (mit der `cn` Funktion, basierend auf `clsx` und `tailwind-merge`) existiert.
4. **UI Komponenten übertragen:**
   Kopiere den gesamten `src/components/ui/` Ordner. Achte besonders auf die Wow-Komponenten (`SpotlightCard.tsx`, `MotionNumber.tsx`, etc.).
5. **Starten:**
   Wende die semantischen Klassen auf deine neuen Seiten an. Das Theme funktioniert sofort.