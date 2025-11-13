type Props = {
	language: "pt" | "en";
	value: string;
	onChange: (t: string) => void;
};
export default function TranscriptView({ language, value, onChange }: Props) {
	return (
		<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
			<label className="block text-sm font-medium text-gray-700 mb-3">
				{language === "pt" ? "Transcrição" : "Transcript"}
			</label>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={8}
				className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
				placeholder={language === "pt" ? "A transcrição aparecerá aqui..." : "Transcription will appear here..."}
			/>
		</div>
	);
}
