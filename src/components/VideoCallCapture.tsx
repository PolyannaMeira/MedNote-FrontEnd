import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

type Props = {
  language: "pt" | "en";
  onTranscriptChange?: (transcript: string) => void;
  patientName: string;
};

export type VideoCallCaptureHandle = {
  reset: () => void;
};

type Status = "idle" | "selecting" | "recording" | "done";

// Função auxiliar para obter prefixo do falante
const getSpeakerPrefix = (
	speaker: "doctor" | "patient",
	patientName: string,
	language: "pt" | "en",
): string => {
	switch (speaker) {
		case "doctor":
			return language === "pt" ? "Médico: " : "Doctor: ";
		case "patient": {
			const name =
				patientName.trim() || (language === "pt" ? "Paciente" : "Patient");
			return `${name}: `;
		}
		default:
			return "Sistema: ";
	}
};

const VideoCallCapture = forwardRef<VideoCallCaptureHandle, Props>(
  ({ language, onTranscriptChange, patientName }, ref) => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [audioDetected, setAudioDetected] = useState<boolean>(false);

  // Sistema de alternância automática para videochamadas
  const speechCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Web Speech API refs para transcrição real-time
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const lastTranscriptRef = useRef<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const labels = {
    pt: {
      title: "Áudio da Videochamada (Meet / Zoom / etc.)",
      start: "Capturar áudio da aba",
      stop: "Parar captura", 
      duration: "Duração:",
      errorPermission: "❌ Permissão negada. INSTRUÇÕES:\n\n1️⃣ Clique em 'Capturar áudio da aba'\n2️⃣ Selecione a ABA do Google Meet (não 'Tela inteira')\n3️⃣ MARQUE a caixa 'Compartilhar áudio da aba'\n4️⃣ Clique em 'Compartilhar'\n\n💡 Se não funcionar, recarregue a página e tente novamente.",
      errorGeneral: "❌ Erro na captura. Verifique se o Meet está tocando áudio e tente novamente.",
      statusRecording: "🔴 Capturando áudio da aba...",
      statusDone: "✅ Transcrição concluída.",
      troubleshooting: "💡 IMPORTANTE: Selecione a ABA do Meet e marque 'Compartilhar áudio da aba'. Se não funcionar, recarregue a página.",
      speechRecognitionError: "❌ Erro na transcrição. Recarregue a página e tente novamente.",
      speechRecognitionUnsupported: "❌ Transcrição não suportada neste navegador. Use Chrome ou Edge."
    },
    en: {
      title: "Video Call Audio (Meet / Zoom / etc.)",
      start: "Capture tab audio",
      stop: "Stop capture",
      duration: "Duration:",
      errorPermission: "❌ Permission denied. INSTRUCTIONS:\n\n1️⃣ Click 'Capture tab audio'\n2️⃣ Select Google Meet TAB (not 'Entire screen')\n3️⃣ CHECK 'Share tab audio' checkbox\n4️⃣ Click 'Share'\n\n💡 If it doesn't work, reload the page and try again.",
      errorGeneral: "❌ Capture error. Check if Meet is playing audio and try again.",
      
      statusRecording: "🔴 Capturing tab audio...",
      statusDone: "✅ Transcription completed.",
      troubleshooting: "💡 IMPORTANT: Select Meet TAB and check 'Share tab audio'. If it fails, reload the page.",
      speechRecognitionError: "❌ Transcription error. Reload the page and try again.",
      speechRecognitionUnsupported: "❌ Transcription not supported in this browser. Use Chrome or Edge."
    }
  };

  const t = labels[language];

  // Setup de áudio para detectar se há som chegando
  const setupAudioDetection = () => {
    if (!streamRef.current) return;
    
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const checkAudio = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / dataArray.length;
        
        // Se detectar áudio acima de threshold
        if (average > 10) {
          setAudioDetected(true);
        }
        
        if (status === "recording") {
          requestAnimationFrame(checkAudio);
        }
      };
      
      checkAudio();
    } catch (err) {
      console.warn("Erro ao configurar detecção de áudio:", err);
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Limpa contexto de áudio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    
    // Limpa speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // Setup Web Speech API para transcrição real-time
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      console.error("Speech recognition not supported");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language === "pt" ? "pt-BR" : "en-US";

    rec.onresult = async (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText + " ";
        } else {
          interimTranscript += transcriptText;
        }
      }

      if (finalTranscript) {
        // Evita processar a mesma fala duas vezes
        const trimmedText = finalTranscript.trim();
        if (trimmedText === lastTranscriptRef.current) {
          return;
        }
        lastTranscriptRef.current = trimmedText;
        
        // Determina falante baseado na alternância automática para videochamadas
        const speakerType: "doctor" | "patient" = speechCountRef.current % 2 === 0 ? "doctor" : "patient";
        
        // Incrementa contador
        speechCountRef.current += 1;
        
        // Adiciona identificação do falante ao texto final
        const speakerPrefix = getSpeakerPrefix(speakerType, patientName, language);
        const formattedText = `${speakerPrefix}${trimmedText}\n`;
        finalTranscriptRef.current += formattedText;

        // Atualiza apenas o componente pai, sem estado local
        const fullTranscript = finalTranscriptRef.current + (interimTranscript ? interimTranscript : "");
        if (onTranscriptChange) {
          onTranscriptChange(fullTranscript);
        }
      } else if (interimTranscript) {
        // Apenas notifica o componente pai com texto interim
        const fullTranscript = finalTranscriptRef.current + interimTranscript;
        if (onTranscriptChange) {
          onTranscriptChange(fullTranscript);
        }
      }
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current = rec;

    return () => {
      if (rec) {
        rec.stop();
      }
    };
  }, [language, onTranscriptChange, patientName]);

  // Função de reset para nova consulta
  const reset = () => {
    cleanup();
    setStatus("idle");
    setError(null);
    setDurationSec(0);
    setAudioDetected(false);
    speechCountRef.current = 0;
    finalTranscriptRef.current = "";
    lastTranscriptRef.current = "";
  };

  // Expõe a função reset para o componente pai
  useImperativeHandle(ref, () => ({
    reset,
  }));

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startCapture = async () => {
    setError(null);
    setDurationSec(0);
    setStatus("selecting");

    try {
      
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      
      // checar se tem track de áudio
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;
      
      if (!hasAudio) {
        
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        setStatus("idle");
        setError(t.errorPermission);
        return;
      }

      
      audioTracks.forEach((track: MediaStreamTrack, index: number) => {
        console.log(`Track ${index}:`, {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });

      
      const enabledAudioTracks = audioTracks.filter((track: MediaStreamTrack) => track.enabled);
      if (enabledAudioTracks.length === 0) {
        
      }

      
      streamRef.current = stream;

      // Reset contadores e transcrições
      finalTranscriptRef.current = "";
      lastTranscriptRef.current = "";
      speechCountRef.current = 0;
      
      // Verificar se Speech Recognition está disponível
      if (!recognitionRef.current) {
        console.error('❌ Speech Recognition não foi inicializado');
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        setStatus("idle");
        setError(t.speechRecognitionUnsupported);
        return;
      }
      
      try {
        // Verificar se já está rodando e parar antes de reiniciar
        try {
          recognitionRef.current.stop();
          // Pequena pausa para garantir que parou
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (stopError) {
          // Ignorar erro se não estava rodando
        }
        
        // Iniciar transcrição
        recognitionRef.current.start();
        setStatus("recording");
        setupAudioDetection();
        
      } catch (recognitionError: any) {
        console.error('❌ Erro ao iniciar Speech Recognition:', recognitionError);
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        setStatus("idle");
        
        if (recognitionError.error === 'already-started') {
          setError(language === "pt" ? 
            "❌ Transcrição já está ativa. Recarregue a página e tente novamente." :
            "❌ Transcription already active. Reload the page and try again.");
        } else {
          setError(t.speechRecognitionError);
        }
        return;
      }

      // contador de tempo
      let sec = 0;
      timerRef.current = window.setInterval(() => {
        sec += 1;
        setDurationSec(sec);
      }, 1000);
    } catch (err: any) {
      console.error("❌ Erro ao capturar aba:", err);
      setStatus("idle");
      
      // Erro específico baseado no tipo
      if (err.name === "NotAllowedError") {
        setError(t.errorPermission);
      } else if (err.name === "NotFoundError") {
        setError(t.errorGeneral);
      } else {
        setError(`${t.errorGeneral} (${err.message})`);
      }
    }
  };

  const stopCapture = () => {
    
    // Para o speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      
    }
    
    cleanup();
    setStatus("done");
    
    // Notifica com transcript final
    if (onTranscriptChange && finalTranscriptRef.current) {
      onTranscriptChange(finalTranscriptRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const statusText = () => {
    switch (status) {
      case "selecting":
        return "Selecionando aba...";
      case "recording":
        return t.statusRecording;
      case "done":
        return t.statusDone;
      default:
        return "";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">{t.title}</h3>

        {/* Status e controles */}
        <div className="flex flex-wrap items-center gap-3">
          {status === "idle" && (
            <button
              onClick={startCapture}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              {t.start}
            </button>
          )}
          
          {status === "recording" && (
            <button
              onClick={stopCapture}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              🛑 {t.stop}
            </button>
          )}
          
          <div className="text-sm text-gray-600 min-w-0">
            {status !== "idle" ? statusText() : ""}
          </div>
          
          {status === "recording" && (
            <>
              <div className="text-sm text-gray-600 whitespace-nowrap">
                {t.duration} {formatTime(durationSec)}
              </div>
              {audioDetected && (
                <div className="text-green-600 text-sm whitespace-nowrap">
                  🎵 {language === "pt" ? "Áudio detectado" : "Audio detected"}
                </div>
              )}
            </>
          )}
        </div>

        {/* Erros com instruções detalhadas */
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <pre className="text-red-800 text-sm whitespace-pre-line font-sans">{error}</pre>
          </div>
        )}

        {/* Instruções sempre visíveis */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="text-blue-700 text-xs leading-relaxed">
            {t.troubleshooting}
          </div>
        </div>
      </div>
    </div>
  );
});

VideoCallCapture.displayName = "VideoCallCapture";

export default VideoCallCapture;