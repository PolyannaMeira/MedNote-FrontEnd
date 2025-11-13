import { useCallback, useRef, useState } from "react";

type SpeakerType = "doctor" | "patient" | "auto";

interface VoiceProfile {
	id: string;
	name: SpeakerType;
	features: {
		avgPitch: number;
		pitchVariance: number;
		avgIntensity: number;
		formantF1: number;
		formantF2: number;
		speechRate: number;
		voiceQuality: number;
	};
	samples: number;
}

interface VoiceAnalysis {
	speaker: SpeakerType;
	confidence: number;
	features: VoiceProfile['features'];
}

export function useVoiceAI() {
	const [voiceProfiles, setVoiceProfiles] = useState<Map<string, VoiceProfile>>(new Map());
	const [isLearning, setIsLearning] = useState(true);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const lastAnalysisRef = useRef<VoiceAnalysis | null>(null);

	// Inicializa contexto de áudio
	const initAudioContext = useCallback(async () => {
		if (!audioContextRef.current) {
			audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
			analyserRef.current = audioContextRef.current.createAnalyser();
			analyserRef.current.fftSize = 2048;
		}
	}, []);

	
	const extractVoiceFeatures = useCallback(async (audioData: Float32Array): Promise<VoiceProfile['features']> => {
		await initAudioContext();
		
		if (!audioContextRef.current || !analyserRef.current) {
			throw new Error("AudioContext não inicializado");
		}

		// Análises simplificadas para performance
		const pitch = calculatePitchOptimized(audioData);
		const intensity = calculateIntensity(audioData);
		const { f1, f2 } = calculateFormantsOptimized(audioData);
		const speechRate = calculateSpeechRateOptimized(audioData);
		
		// Usa pitch variance simples
		const pitchVariance = pitch * 0.1; // Estimativa baseada no pitch
		const voiceQuality = intensity > -20 ? 0.8 : 0.4; // Qualidade baseada na intensidade

		return {
			avgPitch: pitch,
			pitchVariance,
			avgIntensity: intensity,
			formantF1: f1,
			formantF2: f2,
			speechRate,
			voiceQuality
		};
	}, [initAudioContext]);

	// Versão otimizada do cálculo de pitch
	const calculatePitchOptimized = (audioData: Float32Array): number => {
		// Usa apenas uma amostra menor para velocidade
		const sampleSize = Math.min(2048, audioData.length);
		const sample = audioData.slice(0, sampleSize);
		
		let sum = 0;
		let count = 0;
		
		// Estimativa simples baseada em zero-crossings
		for (let i = 1; i < sample.length; i++) {
			if ((sample[i] >= 0) !== (sample[i-1] >= 0)) {
				count++;
			}
			sum += Math.abs(sample[i]);
		}
		
		// Estimativa grosseira de frequência
		const crossingRate = count / (sampleSize / 44100);
		return crossingRate * 0.5; // Aproximação
	};
	
	// Versões otimizadas para performance
	const calculateFormantsOptimized = (audioData: Float32Array): { f1: number, f2: number } => {
		const samples = audioData.slice(0, Math.min(1024, audioData.length));
		
		// Estimativas fixas baseadas em médias
		let sum = 0;
		for (let i = 0; i < samples.length; i++) {
			sum += Math.abs(samples[i]);
		}
		const avgAmplitude = sum / samples.length;
		
		// Estimativas de formantes baseadas em amplitude
		const f1 = 500 + (avgAmplitude * 300); // Entre 500-800Hz
		const f2 = 1200 + (avgAmplitude * 500); // Entre 1200-1700Hz
		
		return { f1, f2 };
	};

	const calculateSpeechRateOptimized = (audioData: Float32Array): number => {
		// Estimativa simples baseada em picos de energia
		let peakCount = 0;
		const threshold = 0.1;
		
		for (let i = 1; i < audioData.length - 1; i++) {
			if (audioData[i] > threshold && 
				audioData[i] > audioData[i-1] && 
				audioData[i] > audioData[i+1]) {
				peakCount++;
			}
		}
		
		// Estima sílabas por segundo
		const duration = audioData.length / 44100;
		return (peakCount / duration) * 0.5; // Ajuste para taxa de fala
	};

	// Calcula intensidade média
	const calculateIntensity = (audioData: Float32Array): number => {
		const rms = Math.sqrt(audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length);
		return 20 * Math.log10(rms + 1e-10); // Converte para dB
	};

	// Compara features e calcula similaridade
	const calculateSimilarity = (features1: VoiceProfile['features'], features2: VoiceProfile['features']): number => {
		const weights = {
			avgPitch: 0.25,
			pitchVariance: 0.15,
			avgIntensity: 0.1,
			formantF1: 0.2,
			formantF2: 0.2,
			speechRate: 0.05,
			voiceQuality: 0.05
		};

		let similarity = 0;
		
		// Normaliza e compara cada feature
		similarity += weights.avgPitch * (1 - Math.abs(features1.avgPitch - features2.avgPitch) / 400);
		similarity += weights.pitchVariance * (1 - Math.abs(features1.pitchVariance - features2.pitchVariance) / 100);
		similarity += weights.avgIntensity * (1 - Math.abs(features1.avgIntensity - features2.avgIntensity) / 60);
		similarity += weights.formantF1 * (1 - Math.abs(features1.formantF1 - features2.formantF1) / 1000);
		similarity += weights.formantF2 * (1 - Math.abs(features1.formantF2 - features2.formantF2) / 2000);
		similarity += weights.speechRate * (1 - Math.abs(features1.speechRate - features2.speechRate) / 10);
		similarity += weights.voiceQuality * (1 - Math.abs(features1.voiceQuality - features2.voiceQuality));
		
		return Math.max(0, Math.min(1, similarity));
	};

	// Identifica o falante baseado nas características da voz
	const identifySpeaker = useCallback(async (audioBlob: Blob): Promise<VoiceAnalysis> => {
		try {
			console.log("🎤 Analisando áudio...", { 
				size: audioBlob.size, 
				profiles: voiceProfiles.size,
				isLearning 
			});
			
			// Converte blob para ArrayBuffer
			const arrayBuffer = await audioBlob.arrayBuffer();
			await initAudioContext();
			
			if (!audioContextRef.current) throw new Error("AudioContext não disponível");
			
			// Decodifica áudio
			const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
			const audioData = audioBuffer.getChannelData(0);
			
			// Extrai características
			const features = await extractVoiceFeatures(audioData);
			console.log("🔍 Features extraídas:", features);
			
			// Se não temos perfis ainda, assume que é doutor primeiro
			if (voiceProfiles.size === 0) {
				console.log("📝 Sem perfis - assumindo doctor");
				const analysis: VoiceAnalysis = {
					speaker: "doctor",
					confidence: 0.7,
					features
				};
				lastAnalysisRef.current = analysis;
				return analysis;
			}
			
			// Compara com perfis existentes
			let bestMatch: { speaker: SpeakerType; similarity: number } = { speaker: "auto", similarity: 0 };
			
			voiceProfiles.forEach((profile) => {
				const similarity = calculateSimilarity(features, profile.features);
				console.log(`🔄 Comparando com ${profile.name}: similaridade ${similarity.toFixed(2)}`);
				if (similarity > bestMatch.similarity) {
					bestMatch = { speaker: profile.name, similarity };
				}
			});
			
			// Se similaridade é alta o suficiente
			const threshold = 0.4; // Reduzido de 0.6 para 0.4 (mais sensível)
			const identifiedSpeaker = bestMatch.similarity > threshold ? bestMatch.speaker : "auto";
			console.log(`🎯 Identificado: ${identifiedSpeaker} (confiança: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
			
			const analysis: VoiceAnalysis = {
				speaker: identifiedSpeaker,
				confidence: bestMatch.similarity,
				features
			};
			
			lastAnalysisRef.current = analysis;
			return analysis;
			
		} catch (error) {
			console.error("❌ Erro na análise de voz:", error);
			return {
				speaker: "auto",
				confidence: 0,
				features: {
					avgPitch: 0,
					pitchVariance: 0,
					avgIntensity: 0,
					formantF1: 0,
					formantF2: 0,
					speechRate: 0,
					voiceQuality: 0
				}
			};
		}
	}, [voiceProfiles, extractVoiceFeatures, initAudioContext, calculateSimilarity]);

	// Registra uma amostra de voz para aprendizado
	const learnVoice = useCallback(async (audioBlob: Blob, speakerType: SpeakerType) => {
		if (!isLearning) return;
		
		try {
			const arrayBuffer = await audioBlob.arrayBuffer();
			await initAudioContext();
			
			if (!audioContextRef.current) return;
			
			const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
			const audioData = audioBuffer.getChannelData(0);
			const features = await extractVoiceFeatures(audioData);
			
			setVoiceProfiles(prev => {
				const newProfiles = new Map(prev);
				const existingProfile = newProfiles.get(speakerType);
				
				if (existingProfile) {
					// Atualiza perfil existente (média ponderada)
					const weight = 0.3; // 30% nova amostra, 70% perfil existente
					const updatedFeatures = {
						avgPitch: existingProfile.features.avgPitch * (1 - weight) + features.avgPitch * weight,
						pitchVariance: existingProfile.features.pitchVariance * (1 - weight) + features.pitchVariance * weight,
						avgIntensity: existingProfile.features.avgIntensity * (1 - weight) + features.avgIntensity * weight,
						formantF1: existingProfile.features.formantF1 * (1 - weight) + features.formantF1 * weight,
						formantF2: existingProfile.features.formantF2 * (1 - weight) + features.formantF2 * weight,
						speechRate: existingProfile.features.speechRate * (1 - weight) + features.speechRate * weight,
						voiceQuality: existingProfile.features.voiceQuality * (1 - weight) + features.voiceQuality * weight,
					};
					
					newProfiles.set(speakerType, {
						...existingProfile,
						features: updatedFeatures,
						samples: existingProfile.samples + 1
					});
				} else {
					// Cria novo perfil
					newProfiles.set(speakerType, {
						id: speakerType,
						name: speakerType,
						features,
						samples: 1
					});
				}
				
				return newProfiles;
			});
			
		} catch (error) {
			console.error("Erro ao aprender voz:", error);
		}
	}, [isLearning, extractVoiceFeatures, initAudioContext]);

	// Reset do sistema
	const resetVoiceProfiles = useCallback(() => {
		setVoiceProfiles(new Map());
		setIsLearning(true);
		lastAnalysisRef.current = null;
	}, []);

	// Para o aprendizado após algumas amostras
	const stopLearning = useCallback(() => {
		setIsLearning(false);
	}, []);

	return {
		identifySpeaker,
		learnVoice,
		resetVoiceProfiles,
		stopLearning,
		isLearning,
		voiceProfiles: Array.from(voiceProfiles.values()),
		lastAnalysis: lastAnalysisRef.current,
		getStats: () => ({
			totalProfiles: voiceProfiles.size,
			doctorSamples: voiceProfiles.get('doctor')?.samples || 0,
			patientSamples: voiceProfiles.get('patient')?.samples || 0,
			isLearning,
		})
	};
}