import { apiClient } from '@/lib/api/client';

import type {
  ModelMetrics,
  ModelStatus,
  PredictionRequest,
  PredictionResponse,
  RetrainResponse,
} from './types';

export const aiService = {
  getStatus() {
    return apiClient.get<ModelStatus>('/ai/status');
  },

  getMetrics() {
    return apiClient.get<ModelMetrics | null>('/ai/metrics');
  },

  predict(payload: PredictionRequest) {
    return apiClient.post<PredictionResponse>('/ai/predict', payload);
  },

  retrain() {
    return apiClient.post<RetrainResponse>('/ai/retrain');
  },
};
