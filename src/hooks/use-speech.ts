import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini as fallback if native recognition fails
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function useSpeechRecognition(onResult: (text: string, isFinal: boolean) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    
    setIsRecording(false);
  }, []);

  const startNativeRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false; // Native not supported
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText.trim()) {
          onResult(currentText.trim(), !!finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') {
          stopRecording();
          toast({ title: 'Spracherkennung fehlgeschlagen', description: 'Versuche Fallback...', variant: 'destructive' });
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (err) {
      console.error('Failed to start native recognition', err);
      return false;
    }
  }, [onResult, toast, stopRecording]);

  const startGeminiFallback = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        try {
          if (!genAI) throw new Error('Kein Gemini API Key gefunden');
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent([
              "Transkribiere dieses Audio auf Deutsch. Antworte NUR mit dem erkannten Text, ohne weitere Formatierung oder Erklärungen. Wenn Mengen und Artikel genannt werden, formatiere sie sauber (z.B. 'FlowFit Bogen 20 5 Stück').",
              {
                inlineData: {
                  data: base64Data,
                  mimeType: "audio/webm"
                }
              }
            ]);
            
            const text = result.response.text().trim();
            if (text) {
              onResult(text, true);
            }
          };
        } catch (error) {
          console.error('Gemini transcription failed', error);
          toast({ title: 'Erkennung fehlgeschlagen', description: 'Bitte tippe den Artikel manuell ein.', variant: 'destructive' });
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('Microphone access denied', err);
      toast({ title: 'Kein Mikrofon-Zugriff', description: 'Bitte erlaube den Zugriff auf das Mikrofon.', variant: 'destructive' });
      return false;
    }
  }, [onResult, toast]);

  const startRecording = useCallback(async () => {
    const nativeStarted = startNativeRecognition();
    if (!nativeStarted && genAI) {
      await startGeminiFallback();
    } else if (!nativeStarted) {
      toast({ title: 'Spracherkennung nicht unterstützt', description: 'Dein Browser unterstützt dies nicht und es ist kein Fallback konfiguriert.', variant: 'destructive' });
    }
  }, [startNativeRecognition, startGeminiFallback, toast]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    isProcessing,
    toggleRecording,
    startRecording,
    stopRecording
  };
}
