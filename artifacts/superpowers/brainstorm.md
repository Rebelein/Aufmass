## Ziel (Goal)
Die bestehende, isolierte Aufmaß-Anwendung soll in ein umfassendes Projekt-Dashboard für Baustellen einer Sanitär-, Heizungs- und Klimatechnik (SHK) Firma umgewandelt werden. Das Dashboard muss das Erstellen neuer Projekte (Baustellen), die Verfolgung laufender Projekte, den Abschluss von Projekten sowie den erneuten Aufruf abgeschlossener Projekte unterstützen.

## Einschränkungen (Constraints)
- Die Benutzeroberfläche (UI) muss schnell und für mobile Geräte optimiert bleiben (PWA), da sie direkt auf der Baustelle genutzt wird.
- Die Änderungen müssen nahtlos in die bestehende Projekt- und Artikel-Datenbankstruktur in Supabase integriert werden.
- Der Wechsel in der Begrifflichkeit von reinem "Aufmaß" hin zu breiteren Begriffen wie "Projekte/Baustellen" sollte konsistent in der gesamten Benutzeroberfläche erfolgen.

## Bekannter Kontext (Known context)
- Tech-Stack: React 18, TypeScript, Vite, Supabase, Tailwind CSS, Radix UI.
- Die aktuellen Dateien `HomePage.tsx` und `ProjectsPage.tsx` bieten nur eingeschränkte Dashboard-Funktionen.
- Das Datenbankschema `projects` speichert derzeit nur grundlegende Informationen (`id`, `name`, `created_at`, `updated_at`).
- SHK-Arbeitsabläufe stützen sich stark auf wiederkehrende Materialien und standardisierte Aufgaben/Abschnitte. Die bestehende Katalog- und Abschnittsarchitektur ist hierfür ideal wiederverwendbar.

## Risiken (Risks)
- Änderungen an der zentralen `projects`-Tabelle könnten bestehende Aufmaß-Funktionen beeinträchtigen, wenn die Migration nicht sorgfältig durchgeführt wird.
- Ein überladenes Dashboard könnte die Benutzerfreundlichkeit auf mobilen Geräten für die Mitarbeiter vor Ort verschlechtern.
- Die Status "Abgeschlossen" (Completed) vs. "Laufend" (Ongoing) sind noch nicht in der Datenbank definiert und erfordern Schema-Anpassungen.

## Optionen (Options) (2–4)
**Option 1: Einfache Hinzufügung eines Status-Flags**
Hinzufügen einer `status`-Spalte (z.B. 'active', 'completed') zur `projects`-Tabelle. Aktualisierung der `HomePage.tsx`, um Projekte abzufragen und in zwei einfache Listen oder Tabs ("Laufend", "Abgeschlossen") aufzuteilen.
*Vorteile:* Am schnellsten zu implementieren, minimale Schema-Änderungen.
*Nachteile:* Bietet wenig Kontext (Datum, Ort) für ein vollwertiges Baustellen-Dashboard.

**Option 2: Umfassendes Schema für Bauprojekte**
Erhebliche Erweiterung der `projects`-Tabelle um Felder wie `status`, `address`, `client_name`, `start_date`, `end_date` und `notes`. Neugestaltung der `HomePage.tsx` als KPI-Dashboard mit aktuellen Aktivitäten, überfälligen Projekten und Schnellaktionen.
*Vorteile:* Bildet eine starke Grundlage für zukünftige SHK-spezifische Funktionen.
*Nachteile:* Erfordert umfangreichere UI-Neugestaltungen und Datenbankmigrationen.

**Option 3: Modulares Dashboard mit "Intelligenten Ordnern"**
Beibehaltung der einfachen `projects`-Basis-Tabelle, aber Einführung einer neuen `project_metadata`-Tabelle für SHK-spezifische Details (Status, Kunde). Verwendung einer Tab-Oberfläche auf dem Dashboard zum Filtern nach "Neu", "In Arbeit" und "Archiv", während das zuletzt aufgerufene Projekt prominent oben hervorgehoben wird.
*Vorteile:* Saubere Trennung der Zuständigkeiten (Separation of Concerns), hält den Aufmaß-Kern schlank.
*Nachteile:* Etwas komplexere Datenbankabfragen.

## Empfehlung (Recommendation)
**Option 2 (Umfassendes Schema für Bauprojekte)** ist der robusteste Ansatz, um die Anwendung zu einem vollwertigen Abteilungswerkzeug zu skalieren. Das Hinzufügen eines `status` (aktiv/abgeschlossen) und grundlegender Metadaten (Kunde, Ort) direkt zur Projekte-Tabelle, kombiniert mit einem auf Tabs oder Karten basierenden Dashboard (`HomePage.tsx`), wird die gewünschte Funktionalität sofort liefern und die App gleichzeitig zukunftssicher machen.

## Akzeptanzkriterien (Acceptance criteria)
- [ ] Das Datenbankschema für `projects` wird um ein `status`-Feld erweitert (Standard: 'active').
- [ ] Die `HomePage.tsx` zeigt ein Dashboard mit klaren Abschnitten/Tabs für "Laufende Baustellen" und "Abgeschlossene Baustellen".
- [ ] Ein Benutzer kann ein neues Projekt (Baustelle) direkt vom Dashboard aus erstellen.
- [ ] Ein Benutzer kann den Status eines Projekts von "aktiv" auf "abgeschlossen" ändern (und umgekehrt).
- [ ] Das Dashboard ist vollständig responsiv und für die mobile Ansicht optimiert.
- [ ] Abgeschlossene Projekte können weiterhin im Nur-Lese- oder Bearbeitungsmodus geöffnet werden (um das Aufmaß einzusehen).
