import { GoogleGenAI } from 'https://esm.sh/@google/genai';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Service nicht konfiguriert. GEMINI_API_KEY fehlt.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Keine Datei gefunden.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Ungültiger Dateityp. Nur PDF und Bilder erlaubt.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'Datei zu groß. Maximum 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = new Uint8Array(bytes);

    // Upload file to Gemini
    const tempFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const uploadedFile = await ai.files.upload({
      file: new Blob([buffer], { type: file.type }),
      mimeType: file.type,
      name: tempFileName,
    });

    // Define the prompt for extraction
    const prompt = `
Du bist ein Experte für die Extraktion von Produktdaten aus Großhändler-Katalogen (z.B. Heizung, Sanitär).

Analysiere die beigefügte Katalogseite (PDF oder Bild).

Aufgabe: Extrahiere alle Artikel. Erfasse dabei sorgfältig die Zugehörigkeiten und Variationen. Oft wird ein Hauptartikel (z.B. "Bogen 90°") als Überschrift genannt und darunter stehen die verschiedenen Größen (z.B. 12mm, 15mm, 22mm) mit ihren jeweiligen Artikelnummern.

Gruppiere diese Variationen sinnvoll, indem du Kategorien/Unterkategorien für die Hauptartikel erstellst.

Die Ausgabe MUSS zwingend als gültiges JSON formatiert sein und folgendem Schema entsprechen:

{
  "categoryName": "Name der Hauptkategorie (z.B. 'Formteile Mapress C-Stahl')",
  "articles": [
    {
      "name": "Vollständiger Name des Artikels inkl. Größe/Variante (z.B. 'Bogen 90° 12mm')",
      "articleNumber": "Die eindeutige Artikelnummer",
      "unit": "Einheit (z.B. 'Stück', 'm', 'kg')",
      "supplierName": "Name des Großhändlers (falls erkennbar, sonst leer lassen)"
    }
  ],
  "subCategories": [
    // Das gleiche Schema rekursiv für Unterkategorien (z.B. 'Bogen 90°', 'Bogen 45°')
  ]
}

WICHTIG:
- Gib NUR das JSON zurück, keine zusätzlichen Erklärungen
- Stelle sicher, dass das JSON valid ist
- Wenn du keine Artikel erkennen kannst, gib ein leeres articles-Array zurück
- supplierName kann leer sein, falls nicht erkennbar
- unit sollte einen sinnvollen Standardwert haben (z.B. 'Stück')

Analysiere nun die Datei:
`;

    // Generate content with Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { fileData: { mimeType: file.type, fileUri: uploadedFile.uri } }
          ]
        }
      ]
    });

    // Extract JSON from response
    const text = response.text || '';
    
    // Try to parse JSON from response
    let result;
    try {
      // Remove markdown code blocks if present
      let jsonStr = text.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response text:', text);
      return new Response(
        JSON.stringify({ 
          error: 'Die KI konnte keine gültigen Daten extrahieren.',
          details: text.substring(0, 200)
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate result structure
    if (!result || typeof result !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Ungültiges Antwortformat der KI.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up: Delete uploaded file
    try {
      await ai.files.delete({ name: uploadedFile.name });
    } catch (cleanupError) {
      console.warn('Could not delete uploaded file:', cleanupError);
    }

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        result: result 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    
    return new Response(
      JSON.stringify({ 
        error: 'Fehler bei der Verarbeitung.',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
