import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../context/LanguageContext';

export function useVoiceAssistant({ onTranscriptReady } = {}) {
  const { currentLangMeta } = useTranslation();
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = currentLangMeta?.speechLocale || 'en-US';

      recognition.onstart = () => {
        setVoiceState('listening');
        setErrorMessage('');
      };

      recognition.onresult = (event) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);

        if (event.results[0].isFinal) {
          setVoiceState('processing');
          if (onTranscriptReady) {
            onTranscriptReady(currentText);
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          setErrorMessage('No speech detected. Please speak into your microphone.');
        } else {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setVoiceState('error');
      };

      recognition.onend = () => {
        if (voiceState === 'listening') {
          setVoiceState('idle');
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Voice initialization error:', err);
      setIsSupported(false);
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch {}
      }
    };
  }, [currentLangMeta?.speechLocale, onTranscriptReady, voiceState]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      setVoiceState('error');
      return;
    }
    try {
      setTranscript('');
      setErrorMessage('');
      recognitionRef.current.lang = currentLangMeta?.speechLocale || 'en-US';
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Could not start recognition:', err);
    }
  }, [currentLangMeta?.speechLocale]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setVoiceState('idle');
  }, []);

  const speak = useCallback((text) => {
    if (!synthRef.current || !text) return;
    try {
      synthRef.current.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLangMeta?.speechLocale || 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setVoiceState('speaking');
      utterance.onend = () => setVoiceState('idle');
      utterance.onerror = () => setVoiceState('idle');

      synthRef.current.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setVoiceState('idle');
    }
  }, [currentLangMeta?.speechLocale]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch {}
    }
    setVoiceState('idle');
  }, []);

  const reset = useCallback(() => {
    stopListening();
    stopSpeaking();
    setTranscript('');
    setErrorMessage('');
    setVoiceState('idle');
  }, [stopListening, stopSpeaking]);

  return {
    voiceState,
    transcript,
    errorMessage,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    reset
  };
}
