import { useState } from "react";
import { API_URL } from "../lib/api";
import type { DiagnosisResponse } from "../lib/types";

type Props = {
	language: "pt" | "en";
	diagnosis: DiagnosisResponse | null;
	transcript: string;
};

export default function ChatIA({ language, diagnosis, transcript }: Props) {
	const [messages, setMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	const [inputMessage, setInputMessage] = useState("");
	const [loading, setLoading] = useState(false);

	const sendMessage = async () => {
		if (!inputMessage.trim() || !diagnosis) return;

		const userMessage = { role: "user" as const, content: inputMessage };
		setMessages((prev) => [...prev, userMessage]);
		setLoading(true);
		setInputMessage("");

		try {
			const response = await fetch(`${API_URL}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: inputMessage,
					context: {
						diagnosis: diagnosis.diagnosis,
						conditions: diagnosis.conditions,
						exams: diagnosis.exams,
						medications: diagnosis.medications,
						transcript,
					},
					language,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const assistantMessage = {
				role: "assistant" as const,
				content: data.response || "Não foi possível processar sua pergunta.",
			};
			setMessages((prev) => [...prev, assistantMessage]);
		} catch (error) {
			console.error("Chat error:", error);
			const errorMsg = {
				role: "assistant" as const,
				content:
					language === "pt"
						? "Desculpe, houve um erro. Tente novamente."
						: "Sorry, there was an error. Please try again.",
			};
			setMessages((prev) => [...prev, errorMsg]);
		} finally {
			setLoading(false);
		}
	};

	if (!diagnosis) return null;

	return (
		<div className="space-y-4">
			{/* Container das mensagens */}
			<div className="bg-white border border-gray-200 rounded-lg shadow-sm max-h-96 overflow-hidden flex flex-col">
				{/* Área de mensagens */}
				<div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-32">
					{messages.length === 0 && (
						<div className="text-center py-3">
							<div className="mb-3">
								<div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
									<svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
								</div>
								<h4 className="text-base font-semibold text-gray-800 mb-1">
									{language === "pt" ? "Como posso ajudar?" : "How can I help?"}
								</h4>
								<p className="text-gray-600 text-xs mb-3">
									{language === "pt"
										? "Faça perguntas sobre o diagnóstico:"
										: "Ask questions about the diagnosis:"}
								</p>
							</div>
							
							{/* Exemplos de perguntas */}
							<div className="grid gap-1.5 max-w-sm mx-auto">
								<button
									onClick={() => setInputMessage(language === "pt" ? "E se o paciente fosse alérgico?" : "What if the patient was allergic?")}
									className="text-left p-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-lg text-xs text-blue-700 transition-all duration-200 hover:shadow-md"
								>
									{language === "pt" ? "E se o paciente fosse alérgico?" : "What if the patient was allergic?"}
								</button>
								<button
									onClick={() => setInputMessage(language === "pt" ? "Quais são os próximos passos?" : "What are the next steps?")}
									className="text-left p-2 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 border border-purple-200 rounded-lg text-xs text-purple-700 transition-all duration-200 hover:shadow-md"
								>
									{language === "pt" ? "Quais são os próximos passos?" : "What are the next steps?"}
								</button>
								<button
									onClick={() => setInputMessage(language === "pt" ? "Existem tratamentos alternativos?" : "Are there alternative treatments?")}
									className="text-left p-2 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 border border-emerald-200 rounded-lg text-xs text-emerald-700 transition-all duration-200 hover:shadow-md"
								>
									{language === "pt" ? "Existem tratamentos alternativos?" : "Are there alternative treatments?"}
								</button>
							</div>
						</div>
					)}

					{messages.map((msg, index) => (
						<div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
							<div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
								msg.role === "user"
									? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
									: "bg-gray-100 text-gray-800 border border-gray-200"
							}`}>
								<p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
							</div>
						</div>
					))}

					{loading && (
						<div className="flex justify-start">
							<div className="bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 max-w-xs lg:max-w-md">
								<div className="flex items-center gap-2">
									<div className="flex gap-1">
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
										<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
									</div>
									<span className="text-sm text-gray-600">
										{language === "pt" ? "IA está pensando..." : "AI is thinking..."}
									</span>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Área de input separada */}
			<div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
				<div className="flex gap-3">
					<div className="flex-1">
						<input
							type="text"
							value={inputMessage}
							onChange={(e) => setInputMessage(e.target.value)}
							placeholder={
								language === "pt"
									? "Digite sua pergunta sobre o diagnóstico..."
									: "Type your question about the diagnosis..."
							}
							onKeyPress={(e) => e.key === "Enter" && sendMessage()}
							disabled={loading}
							className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-sm"
						/>
					</div>
					<button
						onClick={sendMessage}
						disabled={loading || !inputMessage.trim()}
						className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none flex items-center gap-2"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
						</svg>
						{language === "pt" ? "Enviar" : "Send"}
					</button>
				</div>
			</div>
		</div>
	);
}
