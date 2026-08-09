export type HazardCategoryName =
  | 'Machinery'
  | 'Chemical'
  | 'Electrical'
  | 'Ergonomic'
  | 'Slip/Trip/Fall'
  | 'Fire'
  | 'Biological';

export type SeverityLevelName = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PredictionRequest {
  hazardCategory: HazardCategoryName;
  severityLevel: SeverityLevelName;
  recurrenceCount: number;
  isWeekend: boolean;
}

export interface PredictionResponse {
  priority: 'Low' | 'Medium' | 'High';
  confidence: number;
  modelVersion: string;
}

export interface ModelStatus {
  loaded: boolean;
  version: string | null;
  trainedAt: string | null;
  totalRecords: number;
}

export interface ModelMetrics {
  version: string;
  trainedAt: string;
  evaluatedAt: string;
  totalRecords: number;
  trainingRecords: number;
  testRecords: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: [[number, number], [number, number]];
}

export interface RetrainResponse {
  message: string;
  status?: ModelStatus;
}
