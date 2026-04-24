# Rebelein Design System (Aufmaß App)

Willkommen im Design-Paket der Rebelein Aufmaß App. Dieses Verzeichnis dient als "Source of Truth" für das visuelle Erscheinungsbild, die UI-Komponenten und die Interaktionsmuster der Anwendung.

## Philosophie

Das Design-System kombiniert ein hochprofessionelles, "clean" gehaltenes SaaS-Dashboard (für datenintensive Anwendungen) mit dezenten, aber wirkungsvollen "Wow-Effekten" (Micro-Interactions, fließende Zahlen, magnetische Buttons), um die Anwendung lebendig und modern wirken zu lassen. 

Wir verzichten auf starre "Glassmorphism"-Effekte mit hartkodierten Transparenzen (`bg-white/10`) zugunsten eines vollständig semantischen Theme-Systems, das nahtlos zwischen Light- und Dark-Mode wechseln kann.

## Tech Stack

Die Kern-Technologien dieses Design-Systems sind:

1.  **Vite + React (v18+)**: Schnelle, Client-Side-Rendered (CSR) Architektur. Ideal zur Vermeidung von Hydration-Mismatches und perfekt für Offline-first (PWA) Ansätze.
2.  **Tailwind CSS (v4)**: Modernes Utility-First CSS. Wir nutzen die neuen v4 Features (Konfiguration direkt via CSS `@theme`-Block).
3.  **Framer Motion**: Die primäre Animations-Bibliothek für Page-Transitions, Staggered-Lists und Mikro-Interaktionen.
4.  **Radix UI (via shadcn/ui)**: Barrierefreie, ungestylte Basis-Komponenten (Dialoge, Selects, Dropdowns), die mit Tailwind unseren semantischen Look erhalten.
5.  **Lucide React**: Die Standard-Icon-Bibliothek für einen konsistenten, sauberen Strichstärke-Stil.
6.  **mvpblocks / Magic UI / Aceternity UI**: Quellen für komplexe, interaktive "Wow-Komponenten" (wie Spotlight-Karten oder animierte Hintergründe).

## Struktur der Dokumentation

Dieses Paket besteht aus den folgenden Dokumenten:

*   [`STYLING.md`](./STYLING.md): Erklärt das Tailwind v4 Setup, Farb-Tokens (`bg-card`, `text-foreground`) und Radien.
*   [`COMPONENTS.md`](./COMPONENTS.md): Eine Übersicht aller Basis- und "Wow"-Komponenten, deren Herkunft und Verwendung.
*   [`ANIMATIONS.md`](./ANIMATIONS.md): Richtlinien für Framer Motion, Hover-Effekte und Page-Transitions.
*   [`INTEGRATION_GUIDE.md`](./INTEGRATION_GUIDE.md): Ein KI-tauglicher Leitfaden (Prompt-Vorgabe), um dieses Design-System in einem neuen Projekt oder einer anderen Rebelein-Anwendung zu replizieren.

Nutze diese Dokumentation als Blueprint für zukünftige UI-Entwicklungen.
