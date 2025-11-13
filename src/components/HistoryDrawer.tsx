import { useEffect, useMemo, useState } from "react";
import { clearHistory, loadHistory } from "../lib/history";
import type { HistoryItem } from "../lib/types";

type Groups = Record<string, HistoryItem[]>;

function toDateKey(ts: number) {
	const d = new Date(ts);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`; // chave local YYYY-MM-DD
}

function formatDateLabel(key: string) {
	const [y, m, d] = key.split("-").map(Number);
	const dt = new Date(y, m - 1, d);
	return dt.toLocaleDateString(undefined, {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}); // ex: 12 Nov 2025
}

export default function HistoryDrawer() {
	const [items, setItems] = useState<HistoryItem[]>([]);

	const refresh = () => setItems(loadHistory());

	useEffect(() => {
		refresh();
		const handler = () => refresh();
		window.addEventListener("history-updated", handler);
		return () => window.removeEventListener("history-updated", handler);
	}, []);

	// Agrupa por data (mais recente primeiro por grupo e entre grupos)
	const groups = useMemo<Groups>(() => {
		const g: Groups = {};
		for (const it of items) {
			const key = toDateKey(it.timestamp);
			(g[key] ||= []).push(it);
		}
		// ordena cada grupo por timestamp desc
		for (const k of Object.keys(g))
			g[k].sort((a, b) => b.timestamp - a.timestamp);
		return g;
	}, [items]);

	const orderedKeys = useMemo(
		() => Object.keys(groups).sort((a, b) => (a < b ? 1 : -1)),
		[groups],
	);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-gray-800">Histórico</h3>
				<button
					onClick={() => clearHistory()}
					className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md transition-colors"
				>
					Limpar
				</button>
			</div>

			{/* Conteúdo */}
			<div className="space-y-3 max-h-96 overflow-y-auto">
				{items.length === 0 ? (
					<p className="text-gray-500 text-sm text-center py-4">
						Sem consultas salvas ainda.
					</p>
				) : (
					<div className="space-y-3">
						{orderedKeys.map((key) => {
							const list = groups[key];
							return (
								<details key={key} className="bg-gray-50 border border-gray-200 rounded-md">
									<summary className="cursor-pointer p-3 hover:bg-gray-100 transition-colors flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-gray-400">▶</span>
											<span className="font-medium text-gray-700">{formatDateLabel(key)}</span>
										</div>
										<span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">{list.length}</span>
									</summary>
									<div className="border-t border-gray-200 p-3 space-y-3">
										{list.map((i) => (
											<div key={i.id} className="bg-white border border-gray-100 rounded-md p-3 space-y-3">
												<div className="flex items-center justify-between text-xs text-gray-500">
													<span>
														{new Date(i.timestamp).toLocaleTimeString([], {
															hour: "2-digit",
															minute: "2-digit",
														})}
													</span>
													<span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">
														{i.language.toUpperCase()}
													</span>
												</div>

												{/* Nome do Paciente */}
												{i.patientName && (
													<div className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
														Paciente: {i.patientName}
													</div>
												)}

												<div className="space-y-2">
													<div>
														<div className="text-xs font-medium text-gray-500 mb-1">
															Transcrição
														</div>
														<div className="text-xs text-gray-700 bg-gray-50 p-2 rounded text-wrap break-words">
															{i.transcript}
														</div>
													</div>

													<div>
														<div className="text-xs font-medium text-gray-500 mb-2">
															Diagnóstico
														</div>
														<div className="text-xs space-y-1">
															<p className="text-blue-700">
																<span className="font-medium">Diagnóstico:</span> {i.result.diagnosis}
															</p>
															<p className="text-orange-700">
																<span className="font-medium">Condições:</span> {i.result.conditions.join(", ")}
															</p>
															<p className="text-purple-700">
																<span className="font-medium">Exames:</span> {i.result.exams.join(", ")}
															</p>
															<p className="text-green-700">
																<span className="font-medium">Medicamentos:</span> {i.result.medications.join(", ")}
															</p>
															{i.result.explanation && (
																<p className="text-gray-700">
																	<span className="font-medium">Explicação:</span> {i.result.explanation}
																</p>
															)}
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								</details>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
