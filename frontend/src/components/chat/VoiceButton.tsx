import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type SpeechRecognitionType = typeof window.SpeechRecognition;

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording, onTranscript]);

  const hasSpeechAPI = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!hasSpeechAPI) return null;

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled}
      title={isRecording ? 'Stop recording' : 'Voice input'}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
        color: isRecording ? '#ef4444' : '#71717a',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 150ms, color 150ms',
        animation: isRecording ? 'glowPulse 1.5s infinite' : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
}
