import { useState, useRef, useEffect, useCallback } from 'react';

export const useSpeechToText = ({ onTranscriptChange, language = 'en-IN' }: { onTranscriptChange: (finalText: string, interimText: string) => void, language?: string }) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onTranscriptChangeRef = useRef(onTranscriptChange);

  // Keep the latest callback without re-triggering useEffect
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      onTranscriptChangeRef.current(finalTranscript, interimTranscript);
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err.error);
      if (err.error === 'not-allowed') {
        setError('Microphone access denied.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language]); // Only re-run if language changes

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not initialized.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Start error:', err);
      }
    }
  }, [isListening]);

  return { isListening, toggleListening, error };
};
