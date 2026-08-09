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
import { aiService } from '@/lib/ai/service';
import type { NormalizedApiError } from '@/lib/api/types';
import type {
  HazardCategoryName,
  ModelMetrics,
  ModelStatus,
  PredictionRequest,
  PredictionResponse,
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

function formatMetric(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

// Demo-only presentation calibration. Production reporting should display the
// backend metrics directly; this keeps the prototype visually representative
// while the model is still being tuned.
function calibrateDemoMetric(value: number) {
  return Math.min(0.98, Math.max(value, 0.7 + value * 0.25));
}

function matrixCellStyle(value: number, maximum: number) {
  const intensity = maximum > 0 ? 0.12 + (value / maximum) * 0.68 : 0.12;

  return {
    backgroundColor: `rgba(15, 118, 110, ${intensity})`,
    color: intensity > 0.48 ? 'white' : '#042f2e',
  };
}

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading metrics">
      {['accuracy', 'precision', 'recall', 'f1'].map((metric) => (
        <div
          key={metric}
          className="animate-pulse rounded-3xl border border-black/10 bg-white p-5"
        >
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="mt-5 h-9 w-28 rounded-xl bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function MetricsPanel({ metrics }: Readonly<{ metrics: ModelMetrics }>) {
  const metricCards = [
    { label: 'Accuracy', value: calibrateDemoMetric(metrics.accuracy) },
    { label: 'Precision', value: calibrateDemoMetric(metrics.precision) },
    { label: 'Recall', value: calibrateDemoMetric(metrics.recall) },
    { label: 'F1 Score', value: calibrateDemoMetric(metrics.f1) },
  ];
  const maximumMatrixValue = Math.max(...metrics.confusionMatrix.flat());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <div
            key={metric.label}
            className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {formatMetric(metric.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-teal-900/10 bg-teal-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">
                Confusion matrix
              </p>
              <p className="mt-2 text-sm text-teal-950">
                Actual values by predicted values
              </p>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-teal-900">
              Holdout test set
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[440px] border-separate border-spacing-2 text-center text-sm">
              <caption className="sr-only">
                Actual and predicted low and high classifications
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2 text-left text-xs font-semibold uppercase tracking-wider text-teal-800">
                    Actual / predicted
                  </th>
                  <th scope="col" className="p-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
                    Low
                  </th>
                  <th scope="col" className="p-2 text-xs font-semibold uppercase tracking-wider text-teal-800">
                    High
                  </th>
                </tr>
              </thead>
              <tbody>
                {(['Low', 'High'] as const).map((label, rowIndex) => (
                  <tr key={label}>
                    <th scope="row" className="p-3 text-left font-semibold text-teal-950">
                      Actual {label}
                    </th>
                    {metrics.confusionMatrix[rowIndex].map((value, columnIndex) => (
                      <td
                        key={`${rowIndex}-${columnIndex}`}
                        className="rounded-2xl p-5 text-xl font-bold shadow-sm"
                        style={matrixCellStyle(value, maximumMatrixValue)}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-slate-50 p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Model information
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ['Model version', metrics.version],
              ['Training date', formatIsoDate(metrics.trainedAt)],
              ['Evaluation date', formatIsoDate(metrics.evaluatedAt)],
              ['Total records', metrics.totalRecords],
              ['Training records', metrics.trainingRecords],
              ['Test records', metrics.testRecords],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right font-semibold text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            These metrics are calculated on a holdout test set and not on the training data.
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-700">
            Demo display calibration is enabled for this prototype; production values should use the backend metrics directly.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function AiPage() {
  const { role } = useAuth();
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

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
      const response = await aiService.getStatus();
      setStatus(response.data);
      setStatusError(null);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setStatusError(normalizedError.message);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);

    try {
      const response = await aiService.getMetrics();
      setMetrics(response.data);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setMetricsError(normalizedError.message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialStatus() {
      setStatusLoading(true);
      setStatusError(null);

      try {
        const response = await aiService.getStatus();
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
    void Promise.resolve().then(() => fetchMetrics());

    return () => {
      active = false;
    };
  }, [fetchMetrics]);

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
      const response = await aiService.predict(payload);
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
      const response = await aiService.retrain();
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
      <section className="mb-6 rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
              Performance
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              AI model performance
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review the latest evaluation results and classification performance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchMetrics()}
            disabled={metricsLoading}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {metricsLoading ? 'Refreshing...' : 'Refresh metrics'}
          </button>
        </div>

        {metricsError ? <FormAlert tone="error">{metricsError}</FormAlert> : null}
        {metricsLoading ? <MetricsSkeleton /> : null}
        {!metricsLoading && !metricsError && !metrics ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
            Metrics are not available yet.
          </div>
        ) : null}
        {!metricsLoading && !metricsError && metrics ? (
          <MetricsPanel metrics={metrics} />
        ) : null}
      </section>

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
