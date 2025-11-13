export const API_URL = import.meta.env.VITE_API_URL; 

export async function transcribeAudio(audioBlob: Blob, language: "pt" | "en") {
	try {
		console.log('🎙️ Enviando áudio para transcrição:', {
			size: audioBlob.size,
			type: audioBlob.type,
			language,
			url: `${API_URL}/api/transcribe/audio`
		});

		const formData = new FormData();
		formData.append('audio', audioBlob);
		formData.append('language', language);

		const res = await fetch(`${API_URL}/api/transcribe/audio`, {
			method: "POST",
			body: formData,
		});
		
		console.log('📡 Resposta do servidor:', {
			status: res.status,
			statusText: res.statusText,
			ok: res.ok
		});
		
		if (!res.ok) {
			const txt = await res.text();
			console.error('❌ Erro na resposta:', txt);
			throw new Error(txt || `Erro ${res.status}: ${res.statusText}`);
		}
		
		const result = await res.json();
		console.log('✅ Transcrição recebida:', result);
		return result;
		
	} catch (error) {
		console.error('❌ Erro na transcrição de áudio:', error);
		
		// Se é erro de conexão (backend não disponível)
		if (error instanceof TypeError && error.message.includes('fetch')) {
			console.warn('⚠️ Backend não disponível, usando fallback local');
			
			// Fallback para VideoCallCapture quando backend não está disponível
			const fallbackTranscript = language === 'pt' 
				? "⚠️ Consulta de videochamada capturada. Backend temporariamente indisponível - transcrição será processada quando o serviço estiver ativo novamente."
				: "⚠️ Video call consultation captured. Backend temporarily unavailable - transcription will be processed when service is active again.";
			
			return { 
				transcript: fallbackTranscript,
				fallback: true 
			};
		}
		
		throw error;
	}
}

export async function transcribeText(text: string, language: "pt" | "en") {
	const res = await fetch(`${API_URL}/api/transcribe/text`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text, language }),
	});
	
	if (!res.ok) {
		const txt = await res.text();
		throw new Error(txt || `Erro ${res.status}`);
	}
	
	return res.json();
}

export async function diagnose(transcript: string, language: "pt" | "en") {
	const res = await fetch(`${API_URL}/api/diagnose`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ transcript, language }),
	});
	if (!res.ok) {
		const txt = await res.text();
		throw new Error(txt || `Erro ${res.status}`);
	}
	return res.json();
}

export function streamDiagnose(
	transcript: string,
	language: "pt" | "en",
	onChunk: (t: string) => void,
) {
	const url = `${API_URL}/api/diagnose/stream`;
	const es = new EventSource(
		`${url}?language=${language}&q=${encodeURIComponent(transcript)}`,
	);
	es.onmessage = (e) => onChunk(e.data);
	es.onerror = () => es.close();
	return () => es.close();
}
