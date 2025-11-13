import { useRef, useState } from "react";
import DiagnoseView, { type DiagnoseHandle } from "./components/DiagnoseView";
import HistoryDrawer from "./components/HistoryDrawer";
import Recorder, { type RecorderHandle } from "./components/RecorderClean";
import TranscriptView from "./components/TranscriptView";
import { ui } from "./lib/i18n";
import VideoCallCapture, { type VideoCallCaptureHandle } from "./components/VideoCallCapture";

export default function App() {
	const [language, setLanguage] = useState<"pt" | "en">("pt");
	const [transcript, setTranscript] = useState("");
	const [showDiagnosis, setShowDiagnosis] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [currentPatientName, setCurrentPatientName] = useState("");
	const recRef = useRef<RecorderHandle>(null);
	const diagnoseRef = useRef<DiagnoseHandle>(null);
	const videoCallRef = useRef<VideoCallCaptureHandle>(null);
	const t = ui[language];

	const handleNewConsultation = () => {
		recRef.current?.reset();
		diagnoseRef.current?.reset(); 
		videoCallRef.current?.reset(); 
		setTranscript("");
		setShowDiagnosis(false);
		setSidebarOpen(false); 
		setCurrentPatientName(""); 
	};

	return (
		<div className="flex flex-col min-h-screen">
			{/* Header Top */}
			<header className="bg-gradient-to-r from-green-400 to-blue-400 text-white px-8 py-4 shadow-lg flex justify-between items-center relative z-50">
				<div className="flex items-center">
					<h1 className="text-2xl font-bold">
						🩺 {t.title}
					</h1>
				</div>

				<div className="flex items-center gap-4">
					{/* Hambúrguer Mobile */}
					<button
						className="md:hidden text-white text-xl p-2 hover:bg-white/20 rounded"
						onClick={() => setSidebarOpen(!sidebarOpen)}
					>
						☰
					</button>

					{/* Controles Desktop */}
					<div className="hidden md:flex items-center gap-4">
					<button
						className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md font-medium transition-colors"
						onClick={handleNewConsultation}
					>
						{language === "pt" ? "Nova Consulta" : "New Consultation"}
					</button>						<select
							className="bg-white/20 text-white border border-white/30 px-3 py-2 rounded-md font-medium"
							value={language}
							onChange={(e) => setLanguage(e.target.value as any)}
						>
							<option value="pt" className="text-gray-900">PT</option>
							<option value="en" className="text-gray-900">EN</option>
						</select>
					</div>
				</div>
			</header>

			<div className="flex flex-1">
				{/* Sidebar Histórico */}
				<aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 w-80 bg-gray-50 shadow-lg transition-transform duration-300 h-full md:h-auto overflow-y-auto`}>
					<div className="flex items-center justify-between p-4 border-b md:hidden">
					<h3 className="text-lg font-semibold text-gray-800">
						{language === "pt" ? "Menu" : "Menu"}
					</h3>
						<button
							className="text-gray-500 hover:text-gray-700 text-xl p-1"
							onClick={() => setSidebarOpen(false)}
						>
							×
						</button>
					</div>

					{/* Controles do Menu - Apenas mobile */}
					<div className="p-4 space-y-4 md:hidden">
						<button 
							className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium transition-colors mb-4"
							onClick={handleNewConsultation}
						>
							{language === "pt" ? "➕ Nova Consulta" : "➕ New Consultation"}
						</button>

						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-700">
								{language === "pt" ? "🌐 Idioma:" : "🌐 Language:"}
							</label>
							<select
								className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
								value={language}
								onChange={(e) => setLanguage(e.target.value as any)}
							>
								<option value="pt">Português</option>
								<option value="en">English</option>
							</select>
						</div>
					</div>

					{/* Histórico */}
					<div className="flex-1 p-4">
						<section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
							<HistoryDrawer />
						</section>
					</div>
				</aside>

			{/* Content Principal */}
			<main className="flex-1 p-4 lg:p-6 overflow-y-auto">
				{/* Layout Responsivo */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 max-w-7xl mx-auto">
					{/* Seção Gravação */}
					<section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 flex flex-col">
					<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
						{language === "pt" ? "Gravação" : "Recording"}
					</h2>
							<Recorder
								ref={recRef}
								language={language}
								onTranscriptChange={setTranscript}
							/>
							<VideoCallCapture
								ref={videoCallRef}
								language={language}
								onTranscriptChange={setTranscript}
								patientName={currentPatientName}
							/>
						
					</section>
					

					{/* Seção Transcrição */}
					<section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 flex flex-col">
					<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
						{language === "pt" ? "Transcrição" : "Transcription"}
					</h2>
						<div className="flex-1">
							<TranscriptView
								language={language}
								value={transcript}
								onChange={setTranscript}
							/>
						</div>
					</section>

				{/* Seção Diagnóstico - Ocupa duas colunas */}
				<section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 flex flex-col lg:col-span-2">
				<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
					{language === "pt" ? "Diagnóstico" : "Diagnosis"}
				</h2>
						<div className="flex-1">
							<DiagnoseView
								ref={diagnoseRef}
								language={language}
								transcript={transcript}
								patientName={
									currentPatientName || recRef.current?.getPatientName()
								}
								onBeforeFinalize={() => recRef.current?.stop()}
								onFinalizeComplete={() => {
									recRef.current?.reset();
									setTranscript("");
									setShowDiagnosis(false);
								}}
								autoStart={showDiagnosis}
							/>
						</div>
					</section>
				</div>
			</main>
		</div>

		{/* Overlay para fechar sidebar no mobile */}
		{sidebarOpen && (
			<div
				className="fixed inset-0 bg-black/50 z-30 md:hidden"
				onClick={() => setSidebarOpen(false)}
			/>
		)}
	</div>
);
}
