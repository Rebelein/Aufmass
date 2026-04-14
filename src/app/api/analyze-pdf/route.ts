import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
    let tempPath: string | null = null;
    let uploadedFile: any = null;

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: "Keine Datei gefunden." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Save to temp file for Gemini SDK upload
        tempPath = join('/tmp', `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
        await writeFile(tempPath, buffer);

        // Upload to Gemini
        const fileUpload = await ai.files.upload({
          file: tempPath,
          config: { mimeType: file.type },
        });
        uploadedFile = fileUpload;

        // Define the expected output structure in the prompt
        const prompt = `
Du bist ein Experte für die Extraktion von Produktdaten aus Großhändler-Katalogen (z.B. Heizung, Sanitär).
Analysiere die beigefügte Katalogseite (PDF oder Bild).

Aufgabe:
Extrahiere alle Artikel. Erfasse dabei sorgfältig die Zugehörigkeiten und Variationen. Oft wird ein Hauptartikel (z.B. "Bogen 90°") als Überschrift genannt und darunter stehen in einer Tabelle oder Liste die verschiedenen Größen (z.B. 12mm, 15mm, 22mm) mit ihren jeweiligen EINDEUTIGEN ARTIKELNUMMERN. 
Gruppiere diese Variationen sinnvoll, indem du Kategorien/Unterkategorien für die Hauptartikel erstellst.

ACHTUNG: Die Artikelnummer (articleNumber) ist extrem wichtig! Suche aktiv nach Nummernfolgen, EANs oder Lieferanten-Artikelnummern, die neben den Dimensionen/Namen stehen, und ordne sie zwingend dem Feld 'articleNumber' zu.

Die Ausgabe MUSS zwingend als gültiges JSON formatiert sein und folgendem Schema entsprechen:
{
  "categoryName": "Name der Hauptkategorie (z.B. 'Formteile Mapress C-Stahl')",
  "articles": [
    {
      "name": "Vollständiger Name des Artikels inkl. Größe/Variante (z.B. 'Bogen 90° 12mm')",
      "articleNumber": "Die eindeutige Artikelnummer (ZWINGEND ERFORDERLICH)",
      "unit": "Einheit (z.B. 'Stück', 'm', 'kg')",
      "supplierName": "Name des Großhändlers (falls erkennbar, sonst leer lassen)"
    }
  ],
  "subCategories": [
    // Das gleiche Schema rekursiv für Unterkategorien (z.B. 'Bogen 90°', 'Bogen 45°')
    {
       "categoryName": "Bogen 90°",
       "articles": [...],
       "subCategories": []
    }
  ]
}

WICHTIG: Gib NUR das rohe JSON zurück, keine Markdown-Blöcke (\`\`\`), keine Erklärungen.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            fileData: {
                                fileUri: uploadedFile.uri,
                                mimeType: uploadedFile.mimeType
                            }
                        },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });


        let resultJson;
        const responseText = response.text ?? '';
        try {
            resultJson = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", responseText);
            throw new Error("KI lieferte ungültiges JSON.");
        }

        return NextResponse.json({ result: [resultJson] }); // Return as array of top-level categories

    } catch (error: any) {
        console.error("PDF Extraction Error:", error);
        return NextResponse.json({ error: error.message || "Fehler bei der KI-Analyse." }, { status: 500 });
    } finally {
        // Cleanup temp file
        if (tempPath) {
            try { await unlink(tempPath); } catch (e) { console.error("Failed to delete temp file", e); }
        }
        // Cleanup Gemini file
        if (uploadedFile?.name) {
            try { await ai.files.delete({ name: uploadedFile.name }); } catch (e) { console.error("Failed to delete Gemini file", e); }
        }
    }
}
