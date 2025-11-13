import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { useVoiceAI } from "../hooks/useVoiceAI";

type SpeakerType = "doctor" | "patient" | "auto";

// Função auxiliar para obter prefixo do falante
const getSpeakerPrefix = (
	speaker: SpeakerType,
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
		case "auto":
		default:
			return "🤖 "; 
	}
};

type Props = {
	language: "pt" | "en";
	onTranscriptChange: (t: string | ((p: string) => string)) => void;
};

export type RecorderHandle = {
	start: () => void;
	stop: () => void;
	reset: () => void;
	getPatientName: () => string;
};

const Recorder = forwardRef<RecorderHandle, Props>(function Recorder(
	{ language, onTranscriptChange },
	ref,
) {
	const [recording, setRecording] = useState(false);
	const [patientName, setPatientName] = useState<string>("");

	// Sistema de alternância automática de falantes
	const speechCountRef = useRef(0);
	
	const { learnVoice } = useVoiceAI();

	const recognitionRef = useRef<any>(null);
	const finalRef = useRef<string>("");
	const streamRef = useRef<MediaStream | null>(null);
	const isProcessingRef = useRef<boolean>(false);
	const lastSpeakerRef = useRef<SpeakerType>("auto");
	const lastTranscriptRef = useRef<string>(""); 

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
				const transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					finalTranscript += transcript + " ";
				} else {
					interimTranscript += transcript;
				}
			}

			if (finalTranscript) {
				// Evita processar a mesma fala duas vezes
				const trimmedText = finalTranscript.trim();
				if (trimmedText === lastTranscriptRef.current) {
					return;
				}
				lastTranscriptRef.current = trimmedText;
				
				// Determina falante baseado na alternância
				const speakerType: SpeakerType = speechCountRef.current % 2 === 0 ? "doctor" : "patient";
				
				// Incrementa contador
				speechCountRef.current += 1;
				
				// Adiciona identificação do falante ao texto final
				const speakerPrefix = getSpeakerPrefix(speakerType, patientName, language);
				const formattedText = `${speakerPrefix}${trimmedText}\n`;
				finalRef.current += formattedText;
				lastSpeakerRef.current = speakerType;

				// Processa IA em background para aprendizado
				if (streamRef.current && !isProcessingRef.current) {
					processAudioInBackground(speakerType);
				}
			}

		const fullTranscript =
			finalRef.current + (interimTranscript ? `${interimTranscript}` : "");

		onTranscriptChange(fullTranscript);
		};

		rec.onerror = (event: any) => {
			console.error("Speech recognition error:", event.error);
		};

		recognitionRef.current = rec;

		return () => rec.stop();
	}, [language, onTranscriptChange, patientName]);

	// Processa análise de áudio em background sem bloquear
	const processAudioInBackground = async (knownSpeaker: SpeakerType) => {
		if (isProcessingRef.current) return;
		
		isProcessingRef.current = true;
		try {
			// Captura áudio para análise da IA
			const audioBlob = await captureQuickAudioSample();
			if (audioBlob) {
				// Aprende características da voz identificada
				await learnVoice(audioBlob, knownSpeaker);
			}
		} catch (error) {
			console.error("Erro na análise de voz:", error);
		} finally {
			isProcessingRef.current = false;
		}
	};

	// Captura áudio mais rápida (500ms ao invés de 2s)
	const captureQuickAudioSample = async (): Promise<Blob | null> => {
		return new Promise((resolve) => {
			if (!streamRef.current) {
				resolve(null);
				return;
			}

			const chunks: Blob[] = [];
			const mediaRecorder = new MediaRecorder(streamRef.current, {
				mimeType: 'audio/webm;codecs=opus'
			});

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
				}
			};

			mediaRecorder.onstop = () => {
				const audioBlob = new Blob(chunks, { type: 'audio/webm' });
				resolve(audioBlob);
			};

			// Apenas 1000ms para análise mais robusta
			mediaRecorder.start();
			setTimeout(() => {
				if (mediaRecorder.state === 'recording') {
					mediaRecorder.stop();
				}
			}, 1000); // 1 segundo para melhor análise
		});
	};

	const start = async () => {
		try {
			// Captura stream de áudio para análise de voz
			const stream = await navigator.mediaDevices.getUserMedia({ 
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 44100
				}
			});
			streamRef.current = stream;

		onTranscriptChange("");
		finalRef.current = "";
		setRecording(true);
			recognitionRef.current?.start();
		} catch (error) {
			console.error("Erro ao acessar microfone:", error);
		}
	};

	const stop = () => {
		setRecording(false);
		recognitionRef.current?.stop();
		
		// Para processamento em background
		isProcessingRef.current = false;
		
		// Para o stream de áudio
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => track.stop());
			streamRef.current = null;
		}
		
		onTranscriptChange(finalRef.current);
	};

	const reset = () => {
		setRecording(false);
		recognitionRef.current?.stop();
		
		// Para o stream se estiver ativo
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => track.stop());
			streamRef.current = null;
		}
		
		// Limpa refs de processamento
		isProcessingRef.current = false;
		lastSpeakerRef.current = "auto";
		lastTranscriptRef.current = ""; // Limpa último transcript
		
		finalRef.current = "";
		speechCountRef.current = 0; // Reset contador
		onTranscriptChange("");
		setPatientName("");
	};

	const getPatientName = () => {
		return patientName.trim();
	};

	useImperativeHandle(
		ref,
		() => ({
			start,
			stop,
			reset,
			getPatientName,
		}),
		[patientName, language],
	);

	return (
		<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
			{/* Status da gravação */}
			{recording && (
				<div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md p-3">
					<span className="text-red-500 text-lg">🔴</span>
					<span className="text-red-700 font-medium">
						{language === "pt" ? "Gravando..." : "Recording..."}
					</span>
				</div>
			)}

			{/* Campo de Nome do Paciente */}
			<div className="space-y-2">
				<label htmlFor="patientName" className="block text-sm font-medium text-gray-700">
					{language === "pt" ? "Nome do Paciente:" : "Patient Name:"}
				</label>
				<input
					id="patientName"
					type="text"
					value={patientName}
					onChange={(e) => setPatientName(e.target.value)}
					placeholder={
						language === "pt"
							? "Digite o nome do paciente"
							: "Enter patient name"
					}
					className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
					disabled={recording}
				/>
			</div>

			{/* Botão principal de gravação */}
			<div className="flex justify-center">
				<button 
					className={`px-6 py-3 rounded-md font-medium transition-colors ${
						recording
							? "bg-red-500 hover:bg-red-600 text-white"
							: "bg-blue-500 hover:bg-blue-600 text-white"
					}`}
					onClick={recording ? stop : start}
				>
					{recording
						? (language === "pt" ? "Parar Gravação" : "Stop Recording")
						: (language === "pt" ? "Iniciar Gravação" : "Start Recording")}
				</button>
			</div>

			<p className="text-xs text-gray-500 text-center">
				{language === "pt"
					? "💡 Clique para iniciar a gravação da consulta"
					: "💡 Click to start consultation recording"}
			</p>
		</div>
	);
});

export default Recorder;
