'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteShell } from '@/components/layout/route-shell';
import { useHazardWorkflow } from '@/components/hazards/hazard-workflow-provider';
import { useSafetyOfficers } from '@/components/hazards/use-safety-officers';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-context';
import type { HazardReportRecord } from '@/lib/hazards/types';
import { normalizeAiConfidence } from '@/lib/hazards/types';
import { AiPriorityBadge } from '@/components/hazards/ai-priority-badge';
import { getHazardCreatorId } from '@/lib/hazards/types';
import type {
  HazardCategoryOption,
  SeverityLevelOption,
} from '@/lib/hazards/types';
import {
  EMPTY_HAZARD_REPORT_FILTERS,
  buildHazardReportQuery,
  type HazardReportFilters,
} from '@/lib/hazards/filters';
import type { HazardPriority, HazardWorkflowStatus } from '@/lib/hazards/types';

interface FilterPersonOption {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
}

function normalizeLookupList<T>(data: unknown, map: (value: unknown) => T) {
  const items = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : [];
  return items.map(map);
}

function normalizeFilterPerson(value: unknown): FilterPersonOption {
  const record = isRecord(value) ? value : {};
  const department = isRecord(record.department) ? record.department : {};
  const role = typeof record.role === 'string' ? record.role : '';
  return {
    id: readStringValue(record.id),
    name:
      readStringValue(record.fullName) ||
      readStringValue(record.name) ||
      readStringValue(record.email),
    role,
    departmentId:
      readStringValue(record.departmentId) || readStringValue(department.id),
    departmentName:
      readStringValue(department.name) || readStringValue(record.departmentName),
  };
}

const REPORT_STATUSES: HazardWorkflowStatus[] = [
  'Reported',
  'Investigating',
  'Corrective Action',
  'Closed',
];
const AI_PRIORITIES: HazardPriority[] = ['High', 'Medium', 'Low'];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function badgeClasses(kind: 'neutral' | 'success' | 'warning' | 'info') {
  switch (kind) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'info':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringValue(value: unknown, keys: string[] = []) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    for (const key of keys) {
      const next = value[key];
      if (typeof next === 'string' || typeof next === 'number') {
        return String(next);
      }
    }
  }

  return '';
}

function asStringId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    const nestedId =
      value.id ?? value.userId ?? value.reporterId ?? value.creatorId;
    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return String(nestedId);
    }
  }

  return '';
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return '';
}

function firstDateString(...values: unknown[]) {
  const value = firstString(...values);
  return value.length > 0 ? value : '';
}

function readText(value: unknown, keys: string[] = ['name', 'title', 'label']) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    for (const key of keys) {
      const next = value[key];
      if (typeof next === 'string' || typeof next === 'number') {
        return String(next);
      }
    }
  }

  return '';
}

function resolveCreatorId(record: Record<string, unknown>) {
  return getHazardCreatorId({
    createdById: record.createdById,
    reporterId: record.reporterId,
    userId: record.userId,
    authorId: record.authorId,
    creatorId: record.creatorId,
    createdBy: record.createdBy,
    reporter: record.reporter,
    author: record.author,
    user: record.user,
  });
}

function normalizeUserRelation(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = readStringValue(value.id);
  const fullName = readStringValue(value.fullName);
  const jobTitle = readStringValue(value.jobTitle);

  if (!id && !fullName && !jobTitle) {
    return null;
  }

  return {
    id: id || null,
    fullName: fullName || null,
    jobTitle: jobTitle || null,
  };
}

function normalizeInvestigationDetail(
  value: unknown,
  fallbackDate: string | null,
): HazardReportRecord['investigationDetail'] {
  if (!isRecord(value)) {
    return null;
  }

  const findings =
    readStringValue(value.findings) || readStringValue(value.notes);
  const rootCause = readStringValue(value.rootCause);
  const contributingFactors = Array.isArray(value.contributingFactors)
    ? value.contributingFactors.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const investigationDate =
    readStringValue(value.investigationDate) ||
    readStringValue(value.investigatedAt) ||
    fallbackDate;

  if (
    !findings &&
    !rootCause &&
    contributingFactors.length === 0 &&
    !investigationDate
  ) {
    return null;
  }

  return {
    id:
      readStringValue(value.id) ||
      asStringId(value.id) ||
      `inv-${Date.now().toString(36)}`,
    findings,
    rootCause,
    contributingFactors,
    investigationDate,
  };
}

function normalizeCorrectiveAction(
  value: unknown,
): HazardReportRecord['correctiveActions'][number] | null {
  if (typeof value === 'string') {
    const actionDescription = value.trim();
    if (!actionDescription) {
      return null;
    }

    return {
      id: `ca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      actionDescription,
      responsiblePerson: '',
      dueDate: '',
      completed: false,
      createdAt: new Date().toISOString(),
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const actionDescription =
    readStringValue(value.actionDescription) ||
    readStringValue(value.description) ||
    readStringValue(value.note);

  if (!actionDescription) {
    return null;
  }

  return {
    id:
      readStringValue(value.id) ||
      readStringValue(value.correctiveActionId) ||
      readStringValue(value.actionId) ||
      readStringValue(value.corrective_action_id) ||
      `ca-${Date.now().toString(36)}`,
    actionDescription,
    responsiblePerson:
      readStringValue(value.responsiblePerson) ||
      readStringValue(value.owner) ||
      readStringValue(value.assignee),
    dueDate: readStringValue(value.dueDate) || readStringValue(value.due_date),
    completed: Boolean(value.completed),
    createdAt:
      readStringValue(value.createdAt) ||
      readStringValue(value.created_at) ||
      new Date().toISOString(),
  };
}

function normalizeClosureRecord(
  value: unknown,
  fallbackDate: string | null,
): HazardReportRecord['closureRecord'] {
  if (!isRecord(value)) {
    return null;
  }

  const closureNotes =
    readStringValue(value.closureNotes) || readStringValue(value.notes);
  const effectivenessCheck = readStringValue(value.effectivenessCheck) || null;
  const closureDate =
    readStringValue(value.closureDate) ||
    readStringValue(value.closedAt) ||
    readStringValue(value.closed_at) ||
    fallbackDate ||
    '';

  if (!closureNotes && !effectivenessCheck && !closureDate) {
    return null;
  }

  return {
    id: readStringValue(value.id) || `cl-${Date.now().toString(36)}`,
    closureDate,
    closureNotes,
    effectivenessCheck,
  };
}

function normalizeCorrectiveActionList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeCorrectiveAction(item))
    .filter(
      (
        item,
      ): item is NonNullable<ReturnType<typeof normalizeCorrectiveAction>> =>
        item !== null,
    );
}

function resolveCategory(value: unknown) {
  const category = firstString(
    readStringValue(value, [
      'hazardCategory',
      'category',
      'name',
      'label',
      'title',
    ]),
    readText(value, ['name', 'label', 'title']),
    readText(value),
  );

  return category as HazardReportRecord['hazardCategory'];
}

function resolveSeverity(value: unknown) {
  const severity = firstString(
    readStringValue(value, [
      'severityLevel',
      'severity',
      'name',
      'level',
      'label',
    ]),
    readText(value, ['name', 'level', 'label']),
    readText(value, ['label']),
  );

  return severity as HazardReportRecord['severityLevel'];
}

function normalizeHazard(raw: unknown): HazardReportRecord {
  const record = isRecord(raw) ? raw : {};
  const createdById = resolveCreatorId(record);
  const categoryValue = firstString(
    readStringValue(record.hazardCategory, ['name', 'label', 'title']),
    readStringValue(record.category, ['name', 'label', 'title']),
    readStringValue(record.hazardCategoryName, ['name', 'label', 'title']),
    readStringValue(record.categoryName, ['name', 'label', 'title']),
    readText(record.hazardCategory, ['name', 'label', 'title']),
    readText(record.category, ['name', 'label', 'title']),
  );
  const severityValue = firstString(
    readStringValue(record.severityLevel, ['name', 'level', 'label']),
    readStringValue(record.severity, ['name', 'level', 'label']),
    readStringValue(record.severityLevelName, ['name', 'level', 'label']),
    readStringValue(record.severityName, ['name', 'level', 'label']),
    readText(record.severityLevel, ['name', 'level', 'label']),
    readText(record.severity, ['name', 'level', 'label']),
  );
  const createdAt = firstDateString(
    readStringValue(record.createdAt),
    readStringValue(record.created_at),
    readStringValue(record.dateReported),
    readStringValue(record.date_reported),
    readStringValue(record.reportedAt),
    readStringValue(record.reported_at),
    readStringValue(record.created),
    readStringValue(record.reportedDate),
  );
  const updatedAt = firstDateString(
    readStringValue(record.updatedAt),
    readStringValue(record.updated_at),
    readStringValue(record.modifiedAt),
    readStringValue(record.modified_at),
    readStringValue(record.updated),
    createdAt,
  );
  const locationValue = firstString(
    readStringValue(record.location, ['name', 'label', 'title', 'address']),
    readStringValue(record.place, ['name', 'label', 'title', 'address']),
    readStringValue(record.siteLocation),
    readStringValue(record.site),
    readStringValue(record.workLocation),
    readStringValue(record.address),
    readText(record.location),
    readText(record.place),
  );
  const investigationDetail =
    normalizeInvestigationDetail(record.investigationDetail, createdAt) ??
    normalizeInvestigationDetail(record.investigationRecord, createdAt);
  const correctiveActions = [
    ...normalizeCorrectiveActionList(record.correctiveActions),
    ...normalizeCorrectiveActionList(record.correctiveActionRecords),
    ...normalizeCorrectiveActionList(record.correctiveActionNotes),
  ];
  const closureRecord =
    normalizeClosureRecord(record.closureRecord, createdAt) ??
    normalizeClosureRecord(
      {
        id: record.closureRecordId,
        closureDate: record.closureDate,
        closedAt: record.closedAt,
        closed_at: record.closed_at,
        closureNotes: record.closureNote,
        effectivenessCheck: record.effectivenessCheck,
        notes: record.closureNote,
      },
      createdAt,
    );

  return {
    id: readStringValue(record.id) || asStringId(record.id),
    title: firstString(
      readStringValue(record.title),
      readStringValue(record.subject),
      readStringValue(record.name),
    ),
    summary: firstString(
      readStringValue(record.summary),
      readStringValue(record.description),
      readStringValue(record.details),
      readStringValue(record.observation),
    ),
    location: locationValue,
    createdById,
    hazardCategory: resolveCategory(
      record.hazardCategory ??
        record.category ??
        record.hazardCategoryName ??
        record.categoryName ??
        categoryValue,
    ),
    severityLevel: resolveSeverity(
      record.severityLevel ??
        record.severity ??
        record.severityLevelName ??
        record.severityName ??
        severityValue,
    ),
    aiPriority:
      record.aiPriority === 'Low' ||
      record.aiPriority === 'Medium' ||
      record.aiPriority === 'High'
        ? record.aiPriority
        : null,
    aiConfidence: normalizeAiConfidence(record.aiConfidence),
    recurrenceCount:
      typeof record.recurrenceCount === 'number' &&
      Number.isFinite(record.recurrenceCount)
        ? record.recurrenceCount
        : Number(record.recurrenceCount) || 0,
    status: (() => {
      const value = firstString(
        readStringValue(record.status),
        readStringValue(record.workflowStatus),
        readStringValue(record.reportStatus),
      );
      return value === 'Investigating' ||
        value === 'Corrective Action' ||
        value === 'Closed'
        ? value
        : 'Reported';
    })(),
    assignedOfficer:
      normalizeUserRelation(record.assignedOfficer) ??
      normalizeUserRelation(record.assignedTo) ??
      normalizeUserRelation(record.assignee),
    assignedOfficerId:
      firstString(
        readStringValue(record.assignedOfficer, ['id']),
        readStringValue(record.assignedOfficerId),
        readStringValue(record.assignedTo, ['id']),
        readStringValue(record.assignedTo),
        readStringValue(record.assignedToId),
        readStringValue(record.assignee, ['id']),
      ) || null,
    investigationDetail,
    correctiveActions,
    closureRecord,
    investigationNotes:
      asNullableString(record.investigationNotes) ??
      asNullableString(record.notes) ??
      investigationDetail?.findings ??
      null,
    closureNote:
      asNullableString(record.closureNote) ??
      asNullableString(record.closureNotes) ??
      closureRecord?.closureNotes ??
      null,
    closedAt:
      asNullableString(record.closedAt) ??
      asNullableString(record.closed_at) ??
      closureRecord?.closureDate ??
      null,
    createdAt,
    updatedAt,
  };
}

export default function HazardsPage() {
  const { role, currentUser } = useAuth();
  const { reports, replaceReports } = useHazardWorkflow();
  const canResolveAssignees = role === 'manager';
  const { officersById } = useSafetyOfficers(canResolveAssignees);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HazardReportFilters>(
    EMPTY_HAZARD_REPORT_FILTERS,
  );
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [categories, setCategories] = useState<HazardCategoryOption[]>([]);
  const [severityLevels, setSeverityLevels] = useState<SeverityLevelOption[]>(
    [],
  );
  const [people, setPeople] = useState<FilterPersonOption[]>([]);

  const departments = useMemo(() => {
    const unique = new Map<string, string>();
    for (const person of people) {
      if (person.departmentId && person.departmentName) {
        unique.set(person.departmentId, person.departmentName);
      }
    }
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [people]);

  const officers = useMemo(
    () => people.filter((person) => person.role === 'safety_officer'),
    [people],
  );
  const reporters = useMemo(
    () => people.filter((person) => person.role === 'reporter'),
    [people],
  );

  const loadHazards = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await apiClient.get<unknown>('/hazard-reports', {
        params: buildHazardReportQuery(filters),
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const rawHazards = Array.isArray(response.data)
        ? response.data
        : isRecord(response.data) && Array.isArray(response.data.items)
          ? response.data.items
          : [];

      const normalizedHazards = rawHazards.map(normalizeHazard);
      replaceReports(normalizedHazards);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setLoadError(normalizedError.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, replaceReports]);

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      const lookupResults = await Promise.allSettled([
        apiClient.get<unknown>('/hazard-categories'),
        apiClient.get<unknown>('/severity-levels'),
        role === 'admin' || role === 'manager'
          ? apiClient.get<unknown>('/users')
          : Promise.resolve(null),
      ]);

      if (!active) return;
      if (lookupResults[0].status === 'fulfilled') {
        setCategories(
          normalizeLookupList(lookupResults[0].value.data, (value) => {
            const record = isRecord(value) ? value : {};
            return {
              id: readStringValue(record.id),
              name: readStringValue(record.name) as HazardCategoryOption['name'],
              description: null,
              parentId: null,
            };
          }),
        );
      }
      if (lookupResults[1].status === 'fulfilled') {
        setSeverityLevels(
          normalizeLookupList(lookupResults[1].value.data, (value) => {
            const record = isRecord(value) ? value : {};
            return {
              id: readStringValue(record.id),
              name: readStringValue(record.name) as SeverityLevelOption['name'],
              weight: Number(record.weight) || 1,
              description: null,
            };
          }),
        );
      }
      if (lookupResults[2].status === 'fulfilled' && lookupResults[2].value) {
        setPeople(normalizeLookupList(lookupResults[2].value.data, normalizeFilterPerson));
      }
    }
    void loadLookups();
    return () => { active = false; };
  }, [role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHazards();
    }, filters.search.trim() ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [filters.search, loadHazards]);

  function updateFilter<Key extends keyof HazardReportFilters>(
    key: Key,
    value: HazardReportFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ ...EMPTY_HAZARD_REPORT_FILTERS });
  }

  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  const currentUserId = String(currentUser?.id ?? '').trim();

  let visibleReports = reports;

  if (role === 'safety_officer') {
    visibleReports = currentUserId
      ? reports.filter(
          (report) =>
            String(
              report.assignedOfficer?.id ?? report.assignedOfficerId ?? '',
            ).trim() === currentUserId,
        )
      : [];
  } else if (role !== 'admin' && role !== 'manager') {
    visibleReports = currentUserId
      ? reports.filter(
          (report) =>
            String(getHazardCreatorId(report) ?? '').trim() === currentUserId,
        )
      : [];
  }

  const sortedReports = [...visibleReports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const summary = {
    total: sortedReports.length,
    open: sortedReports.filter((report) => report.status !== 'Closed').length,
    closed: sortedReports.filter((report) => report.status === 'Closed').length,
  };

  return (
    <RouteShell
      eyebrow="Hazards"
      title="Hazard reports"
      description="Browse the current hazard register."
    >
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Filter reports</h2>
            <p className="mt-1 text-sm text-slate-600">Refine the report list when needed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersExpanded((current) => !current)}
              aria-expanded={filtersExpanded}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {filtersExpanded ? 'Hide filters' : 'Show filters'}
              {activeFilters.length > 0 ? ` (${activeFilters.length} active)` : ''}
            </button>
            <button type="button" onClick={resetFilters} disabled={activeFilters.length === 0} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Clear filters</button>
          </div>
        </div>
        {filtersExpanded ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">Search<input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Title or description" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950" /></label>
          <label className="text-sm font-medium text-slate-700">Status<select value={filters.status} onChange={(event) => updateFilter('status', event.target.value as HazardWorkflowStatus | '')} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All statuses</option>{REPORT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">AI Priority<select value={filters.aiPriority} onChange={(event) => updateFilter('aiPriority', event.target.value as HazardPriority | '')} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All priorities</option>{AI_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Department<select value={filters.departmentId} onChange={(event) => updateFilter('departmentId', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Hazard category<select value={filters.hazardCategoryId} onChange={(event) => updateFilter('hazardCategoryId', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Severity level<select value={filters.severityLevelId} onChange={(event) => updateFilter('severityLevelId', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All severity levels</option>{severityLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Assigned officer<select value={filters.assignedOfficerId} onChange={(event) => updateFilter('assignedOfficerId', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All officers</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Reporter<select value={filters.reporterId} onChange={(event) => updateFilter('reporterId', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950"><option value="">All reporters</option>{reporters.map((reporter) => <option key={reporter.id} value={reporter.id}>{reporter.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">From date<input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950" /></label>
          <label className="text-sm font-medium text-slate-700">To date<input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-950" /></label>
        </div> : null}
        {activeFilters.length > 0 ? <div className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">{activeFilters.map(([key, value]) => <span key={key} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">{key === 'aiPriority' ? 'AI Priority' : key}: {value}</span>)}</div> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Visible reports
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {summary.total}
          </p>
        </div>
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Open
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {summary.open}
          </p>
        </div>
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Closed
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {summary.closed}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Reports table
            </h2>
            {loadError ? (
              <p className="mt-2 text-sm font-medium text-rose-700">
                {loadError}
              </p>
            ) : null}
          </div>
          {role === 'reporter' ? (
            <Link
              href="/hazards/new"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <p className="text-sm font-semibold text-white">
                New hazard report
              </p>
            </Link>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-black/10 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Title
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Category
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Severity
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Status
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  AI recommendation
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Date Reported
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Assignee
                </th>
                <th className="whitespace-nowrap px-6 py-4 font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading hazard reports...
                  </td>
                </tr>
              ) : sortedReports.length > 0 ? (
                sortedReports.map((report) => {
                  const assignee = report.assignedOfficerId
                    ? officersById.get(report.assignedOfficerId)
                    : null;
                  const assigneeName =
                    report.assignedOfficer?.fullName ||
                    assignee?.fullName ||
                    (report.assignedOfficerId ? 'N/A' : 'Unassigned');
                  const assigneeJobTitle =
                    report.assignedOfficer?.jobTitle ||
                    assignee?.jobTitle ||
                    null;

                  return (
                    <tr key={report.id} className="align-top">
                      <td className="px-6 py-5">
                        <div className="max-w-sm">
                          <p className="font-semibold text-slate-950">
                            {report.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                            {report.location}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {report.hazardCategory}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(
                            report.severityLevel === 'Critical'
                              ? 'warning'
                              : report.severityLevel === 'High'
                                ? 'info'
                                : report.severityLevel === 'Medium'
                                  ? 'neutral'
                                  : 'success',
                          )}`}
                        >
                          {report.severityLevel}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses(
                            report.status === 'Closed' ? 'success' : 'info',
                          )}`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <AiPriorityBadge
                          priority={report.aiPriority}
                          confidence={report.aiConfidence}
                        />
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-6 py-5">
                        {report.assignedOfficer?.fullName || assignee ? (
                          <div>
                            <p className="font-semibold text-slate-950">
                              {assigneeName}
                            </p>
                            {assigneeJobTitle ? (
                              <p className="text-xs text-slate-500">
                                {assigneeJobTitle}
                              </p>
                            ) : null}
                          </div>
                        ) : report.assignedOfficerId ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            N/A
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <Link
                          href={`/hazards/${report.id}`}
                          className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <p className="text-xs font-semibold text-white">
                            View Details
                          </p>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No hazard reports available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </RouteShell>
  );
}
