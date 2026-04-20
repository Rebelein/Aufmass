export interface WhatsNewEntry {
  version: string; // The date, e.g., "12.07.2025"
  title: string;
  changes: string[];
}

export const whatsNewData: WhatsNewEntry[] = [
  {
    version: "12.07.2025",
    title: "Neues 'Was ist neu?'-Fenster",
    changes: [
      "Das bisherige 'Changelog' wurde in ein benutzerfreundlicheres 'Was ist neu?'-Fenster umgewandelt.",
      "Die Liste der Änderungen wird nun automatisch gepflegt und zeigt die neuesten, relevanten Funktionen an.",
    ],
  },
  {
    version: "11.07.2025",
    title: "Komponentenerfassung mit KI-Analyse",
    changes: [
      "Anlagen können jetzt um spezifische Komponenten (z.B. Pumpen, Brenner) erweitert werden.",
      "Ein neuer KI-gestützter Workflow ermöglicht das Scannen von Typenschildern per Kamera.",
      "Die KI extrahiert automatisch Hersteller, Modell, Seriennummer und weitere technische Daten vom Foto.",
      "Es ist nun auch möglich, ein bereits gespeichertes Bild eines Typenschilds hochzuladen und analysieren zu lassen.",
      "Alle extrahierten Komponentendaten können manuell nachbearbeitet und korrigiert werden.",
    ],
  },
  {
    version: "10.07.2025",
    title: "Erweitertes Anlagenbuch & QR-Funktionen",
    changes: [
      "Das 'Digitale Anlagenbuch' hat nun eine eigene Übersichtsseite, auf der alle Anlagen angezeigt und durchsucht werden können.",
      "Anlagen können nicht mehr direkt gelöscht werden. Stattdessen wird eine Löschanforderung an die Verwaltung gesendet.",
      "Im Admin-Bereich gibt es nun einen Papierkorb für gelöschte Anlagen, aus dem sie wiederhergestellt werden können.",
      "Die Anlagenliste kann nach Name oder Nummer durchsucht werden, inklusive einer Schnellsuche-Vorschau.",
      "Die QR-Code Funktionalität wurde aktiviert: QR-Codes für Anlagen können jetzt heruntergeladen und gedruckt werden.",
      "Eine neue Funktion zum Scannen von QR-Codes wurde hinzugefügt, um schnell zum digitalen Anlagenbuch zu gelangen.",
      "Die Benennung in der App wurde von 'Wartung' auf 'Anlagen' umgestellt, um die Funktion klarer zu beschreiben.",
    ],
  },
];

export const latestVersion = whatsNewData[0]?.version || "1.0.0";
