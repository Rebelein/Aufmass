# UI Komponenten

Die Anwendung nutzt eine Mischung aus stabilen Basis-Komponenten und hochgradig interaktiven "Wow-Komponenten".

## 1. Basis-Komponenten (shadcn/ui basierend)
*Ablageort: `src/components/ui/` (Kleinbuchstaben)*

Wir nutzen Radix UI Primitives, die mittels Tailwind CSS gestylt sind. Diese bilden das Rückgrat der Anwendung:
*   `button.tsx`, `input.tsx`, `textarea.tsx`: Formularelemente mit einheitlichen Fokus-Ringen (`focus-visible:ring-1 focus-visible:ring-ring`).
*   `dialog.tsx`, `sheet.tsx`, `alert-dialog.tsx`: Modale Overlays. Der Hintergrund-Blur wird einheitlich über `bg-black/30 backdrop-blur-sm` im Overlay gesteuert.
*   `card.tsx`: Statische Container für Inhalte.

**Verwendung:** Diese Komponenten sollten für alle Standard-UI-Elemente genutzt werden, anstatt native HTML-Tags (`<button>`, `<input>`) zu verwenden, um Barrierefreiheit und Theme-Konsistenz zu wahren.

## 2. "Wow-Komponenten" (mvpblocks / Aceternity inspiriert)
*Primäre Quelle: [mvpblocks Dokumentation](https://blocks.mvp-subha.me/docs/) | [GitHub](https://github.com/subhadeeproy3902/mvpblocks)*
*Ablageort: `src/components/ui/` (PascalCase)*

Diese Komponenten wurden eingeführt, um der App Leben einzuhauchen.

### `SpotlightCard.tsx`
*   **Funktion:** Eine Karte, die einen sanften, dem Mauszeiger folgenden "Taschenlampen"-Effekt (`radial-gradient`) aufweist.
*   **Verwendung:** Für Projekt-Übersichten (`HomePage`) oder wichtige Metriken. Es lenkt die Aufmerksamkeit auf interaktive Kacheln.
*   **Code-Besonderheit:** Nutzt einen `onMouseMove`-Listener am Parent-Container, der die relativen `x`/`y`-Koordinaten berechnet und das Gradient-Center aktualisiert.

### `MotionNumber.tsx`
*   **Funktion:** Animiert eine Zahl flüssig von einem alten auf einen neuen Wert (CountUp/CountDown).
*   **Verwendung:** Für Artikel-Mengen, Gesamtstatistiken und Warenkörbe. Jedes Mal, wenn sich der Wert (`value`) ändert, wird die Animation getriggert.
*   **Code-Besonderheit:** Basiert auf `animate` von Framer Motion. Nutzt einen internen React State für den angezeigten Wert.

### `Magnetic.tsx`
*   **Funktion:** Zieht ein umwickeltes Element (z.B. einen Icon-Button) sanft in Richtung des Mauszeigers, sobald dieser in die Nähe kommt.
*   **Verwendung:** Für "Call to Action"-Buttons (z.B. Plus/Minus-Buttons im Aufmaß, Sync-Trigger). Es erhöht das haptische Feedback.
*   **Code-Besonderheit:** Nutzt Framer Motions `useMotionValue` und `useSpring` zur Berechnung der Verschiebung (`x`, `y`).

### `ShinyText.tsx`
*   **Funktion:** Legt eine animierte, glänzende Maske über einen Text.
*   **Verwendung:** Für wichtige Headlines (z.B. Projektname im Header), um Premium-Gefühl zu erzeugen, ohne aufdringlich zu sein.
*   **Code-Besonderheit:** Verwendet CSS-Keyframes (`animate-shine`) und `linear-gradient`, der durch `background-clip: text` auf die Schrift angewendet wird.

### `AnimatedBackground.tsx`
*   **Funktion:** Dezente, großflächige Hintergrundanimationen (z.B. fließende Blobs, sich langsam bewegende Gradients oder Retro-Grids).
*   **Verwendung:** Als tiefste Z-Ebene (`z-0`) in Haupt-Ansichten (`HomePage`, `AufmassPage`).
*   **Code-Besonderheit:** Reine CSS/Tailwind-Implementierung (z.B. durch `blur-[120px]`, `animate-blob`), um den Main-Thread (React) nicht zu blockieren.

## 3. Bento Grid (Layout-Muster)
Keine explizite Komponente, sondern ein Layout-Prinzip.
*   **Funktion:** Asymmetrische Grid-Layouts (z.B. `grid-cols-4 grid-rows-2`), bei denen Boxen verschiedene Breiten (`col-span-2`) und Höhen (`row-span-2`) einnehmen.
*   **Verwendung:** `HomePage` Statistiken. Es bricht die Monotonie herkömmlicher Kachel-Dashboards auf.
