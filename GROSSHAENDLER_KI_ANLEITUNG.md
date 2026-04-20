# Anleitung: Grosshaendler-Katalog als CSV exportieren

Diese Anleitung richtet sich an eine KI (bzw. ein lokales Analyse-Skript), die den Grosshaendler-Katalog aus einer PDF-Datei analysiert und die strukturierten Daten in eine CSV-Datei exportiert. Diese CSV-Datei wird anschliessend ueber die Aufmass-Anwendung in die Supabase-Datenbank hochgeladen.

---

## WICHTIG: Deine Hauptaufgabe – "Surgical Cleaning" & Kategorien-Struktur

**Bevor du einen einzigen Artikel eintraegst, analysiere zuerst das Inhaltsverzeichnis (Table of Contents) des PDFs.**
Das Inhaltsverzeichnis des Grosshaendler-Katalogs ist in der Regel nach Produktgruppen gegliedert. Zusaetzlich musst du Artikel in spezifische **Bauform-Gruppen (Unterkategorien)** einteilen (z.B. "Bogen", "T-Stueck", "Muffe"), damit nicht alle Varianten unsortiert in einer riesigen Kategorie landen.

---

### Schritt-fuer-Schritt Vorgehen:

**1. Datenstruktur & Ausgabeformat (CSV)**

Das Zielformat ist eine strikte CSV-Datei.
- **Trennzeichen (Separator):** Semikolon (`;`)
- **Kopfzeile (Header):** `Kategorie;Name;Artikel-Nr.;Einheit;Großhändler`
- **Wichtig:** Die Spalte `Kategorie` enthaelt den **kompletten Strukturpfad**, getrennt durch das Groesser-als-Zeichen (`>`).

**Beispiel CSV-Aufbau:**
```csv
Kategorie;Name;Artikel-Nr.;Einheit;Großhändler
Press-Systeme Stahl > Mapress C-Stahl > Rohre;C-Stahl Rohr 15 mm;MMVVR15;m;Geberit
Press-Systeme Stahl > Mapress C-Stahl > Rohre;C-Stahl Rohr 18 mm;MMVVR18;m;Geberit
Press-Systeme Stahl > Mapress C-Stahl > Bogen 90°;Bogen 90° 15mm;MMEB15;Stk;Geberit
Press-Systeme Stahl > Mapress C-Stahl > Bogen 90°;Bogen 90° 22mm;MMEB22;Stk;Geberit
Press-Systeme Stahl > Mapress C-Stahl > T-Stücke;T-Stück 15mm;MMT15;Stk;Geberit
```

**2. Aufbau der `Kategorie`-Pfade (Beliebig viele Ebenen moeglich)**

Der Pfad in der CSV (z.B. `Ebene 1 > Ebene 2 > Ebene 3`) wird von der Anwendung beim Import automatisch in eine verschachtelte Ordnerstruktur umgewandelt.

**Empfohlene Struktur (3-4 Ebenen):**
- **Ebene 1 (Hauptkategorie):** Produktbereich (z.B. "Press-Systeme Stahl")
- **Ebene 2 (Unterkategorie):** Lieferant oder Produktlinie (z.B. "Mapress C-Stahl")
- **Ebene 3 (Bauform-Gruppe):** Artikel-Typ (z.B. "Rohre", "Bogen 90°", "T-Stücke")

*Leite die Bauform-Gruppen (Ebene 3) zwingend ab! Artikel sollen nicht lose in Ebene 2 liegen, wenn sie verschiedenen Bauformen (Bogen, T-Stueck, Rohr) angehoeren.*

**3. "Surgical Cleaning" (Datenbereinigung) – Sehr wichtig!**

Rohe PDF-Exporte enthalten oft "Rauschen". Du musst die Daten zwingend filtern:
- **Keine Index-Eintraege:** Zeilen wie `aduxa Rohre Rohre.......A 179` sind Inhaltsverzeichnisse und KEINE bestellbaren Artikel. Komplett ignorieren.
- **Praegnante Artikelnamen:** Endlose technische Romane in der PDF muessen auf das Wesentliche gekuerzt werden (z.B. "C-Stahl Rohr 15 mm" statt "C-Stahl Leitungsrohr für Trinkwasser- und Heizungsinstallation... 15 mm").
- **Korrektes Verbinden von Tabellen-Fragmenten:** Oft steht in der PDF als Ueberschrift "T-Stück, reduziert" und darunter in einer Tabelle nur noch "16 mm", "20 mm". Der CSV-Name muss dann "T-Stück reduziert 16 mm" lauten, nicht nur "16 mm".
- **Technische Suffixe entfernen:** Interne Rabatt- oder Bestellkuerzel (z.B. "A6AD", "A6AC") am Ende von Artikelnamen sind zu loeschen.
- **Richtige Einheiten:** Nicht alles ist "Stk". Rohre sind oft "m" (Meter), Dichtmasse oft "kg" oder "Dose". Leite dies sinnvoll ab.

**4. Echte Artikelnummern verwenden**

Ein Artikel namens "PE-RT" oder "MV2" ist meist nur eine Produktbezeichnung, keine Artikelnummer. Achte darauf, die tatsaechlichen Bestellnummern (oft 10-15 stellige Codes wie `CCMVRR2650`) in das Feld `Artikel-Nr.` zu setzen.

---

## Bauformen-Referenzliste

Nutze diese Begriffe bevorzugt als letzte Ebene (Untergruppe) im Kategorie-Pfad:

**Rohre & Leitungen:**
- Rohre / Leitungsrohre
- Gewinderohre
- Systemrohre

**Fittings:**
- Bogen 90°
- Bogen 45°
- T-Stücke
- Reduzierstücke
- Schiebemuffen
- Übergangsmuffen
- Übergangsstücke
- Kappen / Verschlussstopfen
- Muffen

**Armaturen:**
- Kugelhähne
- Absperrventile
- Rückschlagventile
- Sicherheitsventile
- Druckminderer

**Wasserzähler:**
- Wasserzähler
- Eichgebühren
- Zubehör

**Befestigung:**
- Rohrhalter
- Konsolen
- Schellen
- Befestigungssets

---

## Zusammenfassung für den KI-Lauf

1. Lies den PDF-Inhalt (oder Rohtext) aus.
2. Entferne Inhaltsverzeichnisse, Seiten-Nummern und Rabatt-Codes.
3. Fasse abgekuerzte Fragmente (nur Massangaben) mit ihrer Hauptbezeichnung zusammen.
4. Leite fuer jeden Artikel einen Kategorie-Pfad ab (`Hauptgruppe > Produktlinie > Bauform`).
5. Generiere eine CSV-Datei mit Semikolon als Trennzeichen, wie oben im Beispiel gezeigt.
6. Die generierte CSV kann dann direkt ueber das Frontend der Rebelein Aufmass App hochgeladen werden!