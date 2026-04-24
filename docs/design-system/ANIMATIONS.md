# Animationen & Mikro-Interaktionen

Animationen sind der Schlüssel zu einer App, die sich "lebendig" anfühlt. Wir nutzen primär **Framer Motion** für physikbasierte, natürliche Bewegungen.

## 1. Page Transitions (Seitenübergänge)

Wenn eine Seite (`HomePage`, `AufmassPage`) geladen oder gewechselt wird, verwenden wir ein sanftes Einblenden und eine leichte vertikale Verschiebung (Fade + Slide).

```tsx
// Standard Page Variant (Framer Motion)
const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

// Verwendung:
<motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
  {/* Seiteninhalt */}
</motion.div>
```

## 2. Staggered Waterfall Effects (Listen-Animationen)

Listen (Artikel, Projekte) dürfen nicht schlagartig als Block erscheinen. Sie werden als kaskadierender "Wasserfall" gerendert.
Dazu nutzt man `staggerChildren` auf dem Parent-Container.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 } // 50ms Verzögerung pro Kind
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
};
```
*Wichtig:* Wir nutzen oft `type: 'spring'` statt linearer Easings, da sich Federn natürlicher und flüssiger anfühlen.

## 3. Hover- und Tap-Zustände (Buttons & Karten)

**Tailwind:** Für einfache Farbwechsel nutzen wir Tailwind (`hover:bg-accent`, `transition-all duration-200`).
**Framer Motion:** Für Skalierungen (Größenänderung) beim Hovern oder Klicken nutzen wir Motion.

```tsx
<motion.div 
  whileHover={{ scale: 1.02 }} 
  whileTap={{ scale: 0.98 }}
>
  Interaktive Karte
</motion.div>
```
*   Tasten und Karten sollten sich beim Antippen (Tap/Click) leicht verkleinern (`scale: 0.95` bis `0.98`), um haptisches Feedback ("Eindrücken") zu simulieren.
*   Beim Hovern sollten sie sich leicht vergrößern oder einen Schatten/Rahmen (`hover:shadow-md hover:border-primary/50`) erhalten.

## 4. AnimatePresence (Mounting / Unmounting)

Um das harte Verschwinden von DOM-Elementen (z.B. Toast-Notifications, Suchergebnissen, gelöschten Artikeln) zu verhindern, wird `AnimatePresence` von Framer Motion eingesetzt.

```tsx
<AnimatePresence>
  {isVisible && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      Content
    </motion.div>
  )}
</AnimatePresence>
```

## 5. CSS Animationen (Endlosschleifen)
Für Background-Blobs oder Ladespinner (die endlos laufen) nutzen wir reine CSS-Animationen via Tailwind in der `index.css` `@theme`-Definition:
*   `animate-pulse` für sanftes Ein/Ausblenden (z.B. Recording-Status).
*   `animate-spin` für Lade-Räder (Sync-Status).
*   `animate-blob` für amorphe Hintergrundformen.