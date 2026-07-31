'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { Can } from '@/components/auth/can';
import { FormAlert, FieldError } from '../../../components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import type {
  HazardCategoryName,
  ModelStatus,
  PredictionRequest,
  PredictionResponse,
  RetrainResponse,
  SeverityLevelName,
} from '@/lib/ai/types';
import { useAuth } from '@/lib/auth/auth-context';
import { toast } from 'sonner';

const HAZARD_CATEGORY_OPTIONS: HazardCategoryName[] = [
  'Machinery',
  'Chemical',
  'Electrical',
  'Ergonomic',
  'Slip/Trip/Fall',
  'Fire',
  'Biological',
];

const SEVERITY_LEVEL_OPTIONS: SeverityLevelName[] = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

function formatConfidence(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return `${Math.round(numericValue <= 1 ? numericValue * 100 : numericValue)}%`;
}

function predictionErrorMessage(error: NormalizedApiError) {
  if (error.status === 403) {
    return 'You do not have permission to run AI predictions.';
  }

  if (error.status === 500) {
    return 'The AI prediction service is unavailable. Please try again later.';
  }

  return error.message;
}

function formatIsoDate(value: string | null) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AiPage() {
  const { role } = useAuth();
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [hazardCategory, setHazardCategory] =
    useState<HazardCategoryName>('Machinery');
  const [severityLevel, setSeverityLevel] = useState<SeverityLevelName>('Low');
  const [recurrenceCount, setRecurrenceCount] = useState(0);
  const [isWeekend, setIsWeekend] = useState(false);
  const [predictError, setPredictError] = useState<NormalizedApiError | null>(
    null,
  );
  const [predictResult, setPredictResult] = useState<PredictionResponse | null>(
    null,
  );
  const [predictLoading, setPredictLoading] = useState(false);

  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null);
  const [retrainError, setRetrainError] = useState<string | null>(null);

  const isRecurrenceOutOfRange = recurrenceCount < 0 || recurrenceCount > 20;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<ModelStatus>('/ai/status');
      setStatus(response.data);
      setStatusError(null);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setStatusError(normalizedError.message);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialStatus() {
      setStatusLoading(true);
      setStatusError(null);

      try {
        const response = await apiClient.get<ModelStatus>('/ai/status');
        if (active) {
          setStatus(response.data);
        }
      } catch (error) {
        if (active) {
          const normalizedError = error as NormalizedApiError;
          setStatusError(normalizedError.message);
        }
      } finally {
        if (active) {
          setStatusLoading(false);
        }
      }
    }

    void loadInitialStatus();

    return () => {
      active = false;
    };
  }, []);

  async function handlePredict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPredictError(null);
    setPredictResult(null);

    if (isRecurrenceOutOfRange) {
      setPredictError({
        status: 400,
        message: 'recurrenceCount must be between 0 and 20.',
        fieldErrors: {
          recurrenceCount: ['recurrenceCount must be between 0 and 20.'],
        },
      });
      return;
    }

    setPredictLoading(true);

    const payload: PredictionRequest = {
      hazardCategory,
      severityLevel,
      recurrenceCount,
      isWeekend,
    };

    try {
      const response = await apiClient.post<PredictionResponse>(
        '/ai/predict',
        payload,
      );
      setPredictResult(response.data);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setPredictError({
        ...normalizedError,
        message: predictionErrorMessage(normalizedError),
      });
    } finally {
      setPredictLoading(false);
    }
  }

  async function handleRetrain() {
    setRetrainError(null);
    setRetrainMessage(null);
    setRetrainLoading(true);

    try {
      const response = await apiClient.post<RetrainResponse>('/ai/retrain');
      if (response.data.status) {
        setStatus(response.data.status);
        setStatusError(null);
      } else {
        await fetchStatus();
      }

      setRetrainMessage(
        response.data.message || 'Model retraining started successfully.',
      );
      toast.success(
        response.data.message || 'Model retraining started successfully.',
      );
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setRetrainError(
        normalizedError.status === 403
          ? 'Only administrators can retrain the AI model.'
          : normalizedError.status === 500
            ? 'The AI model could not be retrained. Please try again later.'
            : normalizedError.message,
      );
    } finally {
      setRetrainLoading(false);
    }
  }

  const canPredict = useMemo(
    () =>
      !predictLoading &&
      !isRecurrenceOutOfRange &&
      status?.loaded !== false,
    [isRecurrenceOutOfRange, predictLoading, status?.loaded],
  );

  return (
    <RouteShell
      eyebrow="AI"
      title="Model telemetry and prediction tools"
      description="All authenticated users can see model status. Prediction and retraining actions stay role-gated in the UI contract."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-black/10 bg-slate-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Model telemetry
          </p>

          {statusError ? (
            <div className="mt-3">
              <FormAlert tone="error">{statusError}</FormAlert>
            </div>
          ) : null}

          <dl className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
            <div className="rounded-2xl bg-white px-4 py-3">
              <dt className="text-slate-500">Model loaded</dt>
              <dd className="font-semibold text-slate-950">
                {statusLoading ? 'Loading...' : status?.loaded ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <dt className="text-slate-500">Version</dt>
              <dd className="font-semibold text-slate-950">
                {statusLoading
                  ? 'Loading...'
                  : status?.version || 'Unavailable'}
              </dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <dt className="text-slate-500">Trained at</dt>
              <dd className="font-semibold text-slate-950">
                {statusLoading
                  ? 'Loading...'
                  : formatIsoDate(status?.trainedAt ?? null)}
              </dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <dt className="text-slate-500">Total records</dt>
              <dd className="font-semibold text-slate-950">
                {statusLoading
                  ? 'Loading...'
                  : typeof status?.totalRecords === 'number'
                    ? status.totalRecords
                    : 'Unavailable'}
              </dd>
            </div>
          </dl>
          {!statusLoading && status && !status.loaded ? (
            <div className="mt-3">
              <FormAlert tone="info">
                The AI model is currently unavailable. Predictions cannot run
                until an administrator loads or retrains the model.
              </FormAlert>
            </div>
          ) : null}
        </div>

        <Can anyOf={['manager', 'safety_officer']}>
          <form
            className="rounded-3xl border border-black/10 bg-emerald-50 p-6"
            onSubmit={handlePredict}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-900">
              Risk calculator
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-950">
              Prediction access is enabled for {role ?? 'authorized'} sessions.
            </p>

            <div className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-emerald-950">
                Hazard category
                <select
                  value={hazardCategory}
                  onChange={(event) =>
                    setHazardCategory(event.target.value as HazardCategoryName)
                  }
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700"
                >
                  {HAZARD_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-emerald-950">
                Severity level
                <select
                  value={severityLevel}
                  onChange={(event) =>
                    setSeverityLevel(event.target.value as SeverityLevelName)
                  }
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700"
                >
                  {SEVERITY_LEVEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-emerald-950">
                Recurrence count (0-20)
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={recurrenceCount}
                  onChange={(event) =>
                    setRecurrenceCount(Number(event.target.value))
                  }
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700"
                />
                <FieldError
                  message={predictError?.fieldErrors?.recurrenceCount?.[0]}
                />
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-emerald-950">
                <input
                  type="checkbox"
                  checked={isWeekend}
                  onChange={(event) => setIsWeekend(event.target.checked)}
                  className="h-4 w-4 rounded border-emerald-300"
                />
                Incident happened during weekend
              </label>
            </div>

            {predictError ? (
              <div className="mt-4">
                <FormAlert tone="error">{predictError.message}</FormAlert>
              </div>
            ) : null}

            {predictResult ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-emerald-950">
                <p>
                  Predicted priority: <strong>{predictResult.priority}</strong>
                </p>
                {formatConfidence(predictResult.confidence) ? (
                  <p>Confidence: {formatConfidence(predictResult.confidence)}</p>
                ) : null}
                <p>Model version: {predictResult.modelVersion}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canPredict}
              className="mt-4 rounded-2xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {predictLoading ? 'Running prediction...' : 'Run prediction'}
            </button>
          </form>
        </Can>

        <Can anyOf={['admin']}>
          <div className="rounded-3xl border border-black/10 bg-amber-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-900">
              Admin controls
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-950">
              Trigger model retraining and refresh telemetry when the operation
              completes.
            </p>

            {retrainError ? (
              <div className="mt-4">
                <FormAlert tone="error">{retrainError}</FormAlert>
              </div>
            ) : null}

            {retrainMessage ? (
              <div className="mt-4">
                <FormAlert tone="success">{retrainMessage}</FormAlert>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRetrain}
              disabled={retrainLoading}
              className="mt-4 rounded-2xl bg-amber-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-400"
            >
              {retrainLoading ? 'Retraining model...' : 'Retrain model'}
            </button>
          </div>
        </Can>
      </div>
    </RouteShell>
  );
}
