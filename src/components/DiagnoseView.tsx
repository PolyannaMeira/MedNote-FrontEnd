import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { diagnose, streamDiagnose } from "../lib/api";
import { saveHistoryItem } from "../lib/history";
import type { DiagnosisResponse, HistoryItem } from "../lib/types";
import ChatIA from "./ChatIA";

type Props = {
	language: "pt" | "en";
	transcript: string;
	patientName?: string;
	onBeforeFinalize?: () => void;
	onFinalizeComplete?: () => void;
	autoStart?: boolean;
};

export type DiagnoseHandle = {
	reset: () => void;
};

const DiagnoseView = forwardRef<DiagnoseHandle, Props>(
	(
		{
			language,
			transcript,
			patientName,
			onBeforeFinalize,
			onFinalizeComplete,
			autoStart = false,
		},
		ref,
	) => {
		const [loading, setLoading] = useState(false);
		const [result, setResult] = useState<DiagnosisResponse | null>(null);
		const [showChat, setShowChat] = useState(false);

		// Auto-iniciar diagnóstico quando finalizar consulta
		useEffect(() => {
			if (autoStart && transcript.trim()) {
				onFinalize();
			}
		}, [autoStart]); // Executa apenas quando autoStart mudar

		// Expor função reset para o componente pai
		useImperativeHandle(
			ref,
			() => ({
				reset: () => {
					setLoading(false);
					setResult(null);
					setShowChat(false);
				},
			}),
			[],
		);

		async function saveAndReset(json: DiagnosisResponse) {
			setResult(json);
			const item: HistoryItem = {
				id: crypto.randomUUID?.() || String(Date.now()),
				timestamp: Date.now(),
				language,
				transcript,
				result: json,
				patientName, // Incluir nome do paciente
			};
			saveHistoryItem(item);
			onFinalizeComplete?.();
			setLoading(false);
		}

		async function doFallbackRequest() {
			const json = await diagnose(transcript, language);
			await saveAndReset(json);
		}

		const onFinalize = async () => {
			if (!transcript.trim()) return;
			onBeforeFinalize?.(); 
			setLoading(true);
			setResult(null);

			try {
				let accumulatedData = "";
				const stop = streamDiagnose(transcript, language, (chunk) => {
					accumulatedData += chunk;
					// Não atualizar streamText para evitar mostrar JSON bruto
				});
				
				setTimeout(async () => {
					stop();
					
					// Tentar processar dados acumulados do streaming
					if (accumulatedData) {
						try {
							const parsedResult = JSON.parse(accumulatedData);
							await saveAndReset(parsedResult);
							return;
						} catch (parseError) {
							console.warn("Erro ao processar streaming, usando fallback:", parseError);
						}
					}
					
					// Fallback se streaming falhou
					await doFallbackRequest();
				}, 8000);
			} catch {
				await doFallbackRequest();
			}
		};

	return (
		<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
			{/* Header com ícone e título */}
			<div className="flex items-center gap-3 pb-4 border-b border-gray-100">
				<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
					<span className="text-white text-lg font-bold">IA</span>
				</div>
				<div>
					<h3 className="text-lg font-semibold text-gray-800">
						{language === "pt" ? "Assistente Médico IA" : "Medical AI Assistant"}
					</h3>
					<p className="text-sm text-gray-500">
						{language === "pt" ? "Análise inteligente de sintomas" : "Intelligent symptom analysis"}
					</p>
				</div>
			</div>

			<button 
				onClick={onFinalize} 
				disabled={loading || !transcript.trim()}
				className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
			>
				<span className="flex items-center justify-center gap-2">
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					{language === "pt" ? "Finalizar Consulta" : "Finish Session"}
				</span>
			</button>

			{loading && (
				<div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
					<div className="flex items-center justify-center gap-4">
						<div className="relative">
							<div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200"></div>
							<div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent absolute top-0 left-0"></div>
						</div>
						<div className="text-center">
							<p className="text-blue-700 font-semibold text-lg">
								{language === "pt"
									? "Gerando diagnóstico..."
									: "Generating diagnosis..."}
							</p>
							<p className="text-blue-600 text-sm mt-1">
								{language === "pt"
									? "Analisando sintomas com IA médica"
									: "Analyzing symptoms with medical AI"}
							</p>
						</div>
					</div>
				</div>
			)}

			{result && (
				<div className="space-y-6">
					{/* Título principal reformulado */}
					<div className="text-center pb-4">
						<div className="flex items-center justify-center gap-3 mb-2">
							<div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
								<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 className="text-xl font-bold text-gray-800">
								{language === "pt" ? "Relatório de Consulta" : "Consultation Report"}
							</h3>
						</div>
						<p className="text-gray-600 text-sm">
							{language === "pt" ? "Análise baseada nos sintomas relatados" : "Analysis based on reported symptoms"}
						</p>
					</div>

					<div className="grid gap-6">
						{/* Diagnóstico principal */}
						<div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
									<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-semibold text-blue-800 mb-3">
										{language === "pt" ? "Diagnóstico Provável" : "Probable Diagnosis"}
									</h4>
									<p className="text-blue-700 leading-relaxed text-base">{result.diagnosis}</p>
								</div>
							</div>
						</div>

						{/* Condições identificadas */}
						<div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
									<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-semibold text-amber-800 mb-3">
										{language === "pt" ? "Condições Identificadas" : "Identified Conditions"}
									</h4>
									<div className="flex flex-wrap gap-2">
										{result.conditions.map((condition, index) => (
											<span 
												key={index} 
												className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200"
											>
												{condition}
											</span>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Exames sugeridos */}
						<div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6">
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
									<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
									</svg>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-semibold text-purple-800 mb-3">
										{language === "pt" ? "Exames Sugeridos" : "Suggested Tests"}
									</h4>
									<div className="space-y-2">
										{result.exams.map((exam, index) => (
											<div 
												key={index} 
												className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100"
											>
												<div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
												<span className="text-purple-700 text-sm font-medium">{exam}</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Medicamentos recomendados */}
						<div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6">
							<div className="flex items-start gap-4">
								<div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
									<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
									</svg>
								</div>
								<div className="flex-1">
									<h4 className="text-lg font-semibold text-emerald-800 mb-3">
										{language === "pt" ? "Medicamentos Recomendados" : "Recommended Medications"}
									</h4>
									<div className="space-y-2">
										{result.medications.map((medication, index) => (
											<div 
												key={index} 
												className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100"
											>
												<div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
													<div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
												</div>
												<span className="text-emerald-700 text-sm font-medium leading-relaxed">{medication}</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Raciocínio da IA */}
						{result.explanation && (
							<div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-6">
								<div className="flex items-start gap-4">
									<div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
										<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
										</svg>
									</div>
									<div className="flex-1">
										<h4 className="text-lg font-semibold text-gray-800 mb-3">
											{language === "pt" ? "Raciocínio da IA" : "AI Reasoning"}
										</h4>
										<p className="text-gray-700 leading-relaxed mb-4">{result.explanation}</p>
										<div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
											<p className="text-xs text-gray-600 flex items-center gap-2">
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												{language === "pt"
													? "Esta análise foi baseada nos sintomas relatados e padrões clínicos conhecidos."
													: "This analysis was based on reported symptoms and known clinical patterns."}
											</p>
										</div>
									</div>
								</div>
							</div>
						)}

						
						<div className="flex justify-center pt-4">
							<button
								className="group bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-3"
								onClick={() => setShowChat(!showChat)}
								type="button"
							>
								<div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
								</div>
								<span className="text-lg">
									{showChat
										? language === "pt"
											? "Fechar Chat com IA"
											: "Close AI Chat"
										: language === "pt"
											? "Chat com IA Médica"
											: "Chat with Medical AI"}
								</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Chat IA Contextual com design moderno */}
			{result && showChat && (
				<div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 mt-6">
					<div className="flex items-center gap-3 mb-4 pb-4 border-b border-indigo-200">
						<div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
							<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
						</div>
						<div>
							<h4 className="text-lg font-semibold text-indigo-800">
								{language === "pt" ? "Chat com IA Médica" : "Medical AI Chat"}
							</h4>
							<p className="text-sm text-indigo-600">
								{language === "pt" ? "Faça perguntas sobre seu diagnóstico" : "Ask questions about your diagnosis"}
							</p>
						</div>
					</div>
					<ChatIA
						language={language}
						diagnosis={result}
						transcript={transcript}
					/>
				</div>
			)}
		</div>
	);
	},
);

DiagnoseView.displayName = "DiagnoseView";

export default DiagnoseView;
