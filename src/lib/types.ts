export type DiagnosisResponse = {
	diagnosis: string;
	conditions: string[];
	exams: string[];
	medications: string[];
	explanation?: string;
	language: "pt" | "en";
};

export type HistoryItem = {
	id: string;
	timestamp: number;
	language: "pt" | "en";
	transcript: string;
	result: DiagnosisResponse;
	patientName?: string; // Nome do paciente
};
