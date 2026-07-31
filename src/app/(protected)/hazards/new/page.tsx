'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useRouter } from 'next/navigation';

import {
  FieldError,
  FormAlert,
} from '../../../../components/auth/form-feedback';
import { RequireRole } from '@/components/auth/require-role';
import { RouteShell } from '@/components/layout/route-shell';
import { useHazardWorkflow } from '@/components/hazards/hazard-workflow-provider';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import type {
  CreateHazardReportDraft,
  HazardCategoryOption,
  SeverityLevelOption,
} from '@/lib/hazards/types';

interface LookupErrorState {
  categories: string | null;
  severities: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeList<T>(data: unknown, mapItem: (item: unknown) => T): T[] {
  if (Array.isArray(data)) {
    return data.map(mapItem);
  }

  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items.map(mapItem);
  }

  return [];
}

function normalizeHazardCategory(raw: unknown): HazardCategoryOption {
  const record = isRecord(raw) ? raw : {};

  return {
    id: asString(record.id),
    name: asString(record.name) as HazardCategoryOption['name'],
    description: asNullableString(record.description),
    parentId: asNullableString(record.parentId),
  };
}

function normalizeSeverityLevel(raw: unknown): SeverityLevelOption {
  const record = isRecord(raw) ? raw : {};

  return {
    id: asString(record.id),
    name: asString(record.name) as SeverityLevelOption['name'],
    weight: asNumber(record.weight, 1),
    description: asNullableString(record.description),
  };
}

function getFieldError(error: NormalizedApiError | null, field: string) {
  return error?.fieldErrors?.[field]?.[0];
}

export default function NewHazardPage() {
  const router = useRouter();
  const { createHazardReport } = useHazardWorkflow();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [location, setLocation] = useState('');
  const [hazardCategoryId, setHazardCategoryId] = useState('');
  const [severityLevelId, setSeverityLevelId] = useState('');
  const [hazardCategories, setHazardCategories] = useState<
    HazardCategoryOption[]
  >([]);
  const [severityLevels, setSeverityLevels] = useState<SeverityLevelOption[]>(
    [],
  );
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupErrors, setLookupErrors] = useState<LookupErrorState>({
    categories: null,
    severities: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<NormalizedApiError | null>(null);

  const selectedHazardCategory = useMemo(
    () =>
      hazardCategories.find((option) => option.id === hazardCategoryId) ?? null,
    [hazardCategories, hazardCategoryId],
  );

  const selectedSeverityLevel = useMemo(
    () =>
      severityLevels.find((option) => option.id === severityLevelId) ?? null,
    [severityLevels, severityLevelId],
  );

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      summary.trim().length > 0 &&
      location.trim().length > 0 &&
      hazardCategoryId.trim().length > 0 &&
      severityLevelId.trim().length > 0 &&
      !lookupsLoading &&
      hazardCategories.length > 0 &&
      severityLevels.length > 0,
    [
      hazardCategories.length,
      hazardCategoryId,
      lookupsLoading,
      location,
      severityLevelId,
      severityLevels.length,
      summary,
      title,
    ],
  );

  useEffect(() => {
    let active = true;

    async function loadLookups() {
      setLookupsLoading(true);
      setLookupErrors({ categories: null, severities: null });

      const [categoriesResult, severitiesResult] = await Promise.allSettled([
        apiClient.get<unknown>('/hazard-categories'),
        apiClient.get<unknown>('/severity-levels'),
      ]);

      if (!active) {
        return;
      }

      if (categoriesResult.status === 'fulfilled') {
        setHazardCategories(
          normalizeList(categoriesResult.value.data, normalizeHazardCategory),
        );
        setLookupErrors((current) => ({ ...current, categories: null }));
      } else {
        const normalizedError = categoriesResult.reason as NormalizedApiError;
        setHazardCategories([]);
        setLookupErrors((current) => ({
          ...current,
          categories: normalizedError.message,
        }));
      }

      if (severitiesResult.status === 'fulfilled') {
        setSeverityLevels(
          normalizeList(severitiesResult.value.data, normalizeSeverityLevel),
        );
        setLookupErrors((current) => ({ ...current, severities: null }));
      } else {
        const normalizedError = severitiesResult.reason as NormalizedApiError;
        setSeverityLevels([]);
        setLookupErrors((current) => ({
          ...current,
          severities: normalizedError.message,
        }));
      }

      setLookupsLoading(false);
    }

    void loadLookups();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldError(null);

    if (!selectedHazardCategory || !selectedSeverityLevel) {
      setFieldError({
        status: 400,
        message: 'Hazard category and severity level are required.',
        fieldErrors: {
          hazardCategoryId: !selectedHazardCategory
            ? ['Hazard category is required.']
            : [],
          severityLevelId: !selectedSeverityLevel
            ? ['Severity level is required.']
            : [],
        },
      });
      setIsSubmitting(false);
      return;
    }

    if (lookupErrors.categories || lookupErrors.severities) {
      setFormError(
        'Lookup data is still unavailable. Please refresh and try again.',
      );
      setIsSubmitting(false);
      return;
    }

    const draft: CreateHazardReportDraft = {
      title: title.trim(),
      summary: summary.trim(),
      location: location.trim(),
      hazardCategory: selectedHazardCategory.name,
      severityLevel: selectedSeverityLevel.name,
    };

    const payload = {
      title: draft.title,
      description: draft.summary,
      hazardCategoryId: selectedHazardCategory.id,
      severityLevelId: selectedSeverityLevel.id,
    };

    try {
      const created = await createHazardReport(payload, draft);
      router.push(`/hazards/${created.id}`);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setFieldError(normalizedError);
      setFormError(
        normalizedError.fieldErrors ? null : normalizedError.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RequireRole allowedRoles={['reporter']}>
      <RouteShell
        eyebrow="Hazard submission"
        title="Create a new hazard report"
        description="Capture the essentials, choose the live hazard reference data from the backend, and send the report for immediate follow-up."
      >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.05)]"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                New hazard report
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                The category and severity lists are loaded directly from the
                backend on mount.
              </p>
            </div>

            {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

            {lookupErrors.categories || lookupErrors.severities ? (
              <FormAlert tone="info">
                Some reference data could not be loaded. Categories{' '}
                {lookupErrors.categories ? 'are unavailable' : 'are ready'}, and
                severity levels{' '}
                {lookupErrors.severities ? 'are unavailable' : 'are ready'}.
              </FormAlert>
            ) : null}

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError message={getFieldError(fieldError, 'title')} />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Description
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="mt-2 min-h-32 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError message={getFieldError(fieldError, 'description')} />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Location
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError message={getFieldError(fieldError, 'location')} />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Hazard category
                <select
                  value={hazardCategoryId}
                  onChange={(event) => setHazardCategoryId(event.target.value)}
                  className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={lookupsLoading || hazardCategories.length === 0}
                  required
                >
                  <option value="">
                    {lookupsLoading
                      ? 'Loading categories...'
                      : 'Select a category'}
                  </option>
                  {hazardCategories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                {selectedHazardCategory?.description ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {selectedHazardCategory.description}
                  </p>
                ) : null}
                <FieldError
                  message={getFieldError(fieldError, 'hazardCategoryId')}
                />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Severity level
                <select
                  value={severityLevelId}
                  onChange={(event) => setSeverityLevelId(event.target.value)}
                  className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={lookupsLoading || severityLevels.length === 0}
                  required
                >
                  <option value="">
                    {lookupsLoading
                      ? 'Loading severity levels...'
                      : 'Select a severity'}
                  </option>
                  {severityLevels.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                {selectedSeverityLevel?.description ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Weight {selectedSeverityLevel.weight}.{' '}
                    {selectedSeverityLevel.description}
                  </p>
                ) : null}
                <FieldError
                  message={getFieldError(fieldError, 'severityLevelId')}
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/hazards')}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? 'Submitting...' : 'Submit hazard report'}
              </button>
            </div>
          </div>
        </form>

        <aside className="grid gap-4">
          <div className="rounded-3xl border border-black/10 bg-emerald-50 p-6 text-sm leading-6 text-emerald-950">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-800">
              Safety first
            </p>
            <p className="mt-3 text-base font-medium leading-7">
              Your vigilance keeps us safe. Detail the hazard below so our
              safety team can take immediate action.
            </p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-slate-50 p-6 text-sm leading-6 text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              What happens next
            </p>
            <p className="mt-3">
              Once submitted, the report is stored through the Axios client,
              added to the local hazard workflow state, and routed to the new
              detail view.
            </p>
          </div>
        </aside>
      </div>
      </RouteShell>
    </RequireRole>
  );
}
