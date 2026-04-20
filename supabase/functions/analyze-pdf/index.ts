import { GoogleGenAI } from 'https://esm.sh/@google/genai';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Konfigurationsfehler', details: 'GEMINI_API_KEY fehlt in Supabase Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Datei fehlt', details: 'Es wurde keine Datei hochgeladen.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sicherere Base64-Umwandlung für große Dateien
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Data = encodeBase64(uint8Array);

    const genAI = new GoogleGenAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Du bist ein Experte für die Extraktion von Produktdaten aus Großhändler-Katalogen.
Analysiere die beigefügte Katalogseite.
Extrahiere alle Artikel. Gruppiere Variationen (z.B. verschiedene Größen eines Produkts) sinnvoll.
Die Ausgabe MUSS zwingend als gültiges JSON erfolgen:
{
  "categoryName": "Name der Hauptkategorie",
  "articles": [
    {
      "name": "Vollständiger Name inkl. Größe",
      "articleNumber": "Artikelnummer",
      "unit": "Stück/m/etc",
      "supplierName": "Großhändler"
    }
  ],
  "subCategories": []
}
Gib NUR das JSON zurück.
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      }
    ]);

    const text = result.response.text();
    let jsonStr = text.trim();
    
    // Markdown-Code-Blöcke entfernen, falls vorhanden
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json|```/g, '').trim();
    }

    const data = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'KI Fehler', 
        details: error instanceof Error ? error.message : 'Unbekannter Fehler bei der Verarbeitung' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
