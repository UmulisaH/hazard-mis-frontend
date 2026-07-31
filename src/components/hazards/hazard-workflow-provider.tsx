'use client';

import {
  createContext,
  useEffect,
  use,
  useCallback,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import type {
  CreateHazardReportDraft,
  AssignHazardReportRequest,
  CloseHazardReportRequest,
  CreateHazardReportRequest,
  CorrectiveActionRequest,
  CorrectiveActionRecord,
  ClosureRecord,
  HazardReportRecord,
  InvestigationDetail,
  HazardWorkflowStatus,
  InvestigateHazardReportRequest,
  UpdateCorrectiveActionRequest,
  UpdateHazardReportStatusRequest,
} from '@/lib/hazards/types';
import { normalizeAiConfidence } from '@/lib/hazards/types';
import type {
  HazardCategoryName,
  SeverityLevelName,
} from '@/lib/ai/types';
import { getHazardCreatorId } from '@/lib/hazards/types';
import { isPastDateInputValue } from '@/lib/hazards/date-input';
import type { NormalizedApiError } from '@/lib/api/types';

type HazardWorkflowContextValue = {
  reports: HazardReportRecord[];
  getReportById: (id: string) => HazardReportRecord | null;
  replaceReports: (nextReports: HazardReportRecord[]) => void;
  fetchHazardReports: () => Promise<HazardReportRecord[]>;
  fetchHazardReport: (id: string) => Promise<HazardReportRecord>;
  createHazardReport: (
    payload: CreateHazardReportRequest,
    draft: CreateHazardReportDraft,
  ) => Promise<HazardReportRecord>;
  assignHazardReport: (
    id: string,
    payload: AssignHazardReportRequest,
  ) => Promise<HazardReportRecord>;
  updateHazardReportStatus: (
    id: string,
    payload: UpdateHazardReportStatusRequest,
  ) => Promise<HazardReportRecord>;
  investigateHazardReport: (
    id: string,
    payload: InvestigateHazardReportRequest,
  ) => Promise<HazardReportRecord>;
  addCorrectiveAction: (
    id: string,
    payload: CorrectiveActionRequest,
  ) => Promise<HazardReportRecord>;
  updateCorrectiveAction: (
    id: string,
    actionId: string,
    payload: UpdateCorrectiveActionRequest,
  ) => Promise<HazardReportRecord>;
  closeHazardReport: (
    id: string,
    payload: CloseHazardReportRequest,
  ) => Promise<HazardReportRecord>;
};

type HazardReportsAction =
  | { type: 'reports/replace'; reports: HazardReportRecord[] }
  | { type: 'report/created'; report: HazardReportRecord }
  | { type: 'report/assigned'; report: HazardReportRecord }
  | { type: 'report/investigated'; report: HazardReportRecord }
  | { type: 'report/corrective-action-added'; report: HazardReportRecord }
  | { type: 'report/corrective-action-updated'; report: HazardReportRecord }
  | { type: 'report/closed'; report: HazardReportRecord };

const HazardWorkflowContext =
  createContext<HazardWorkflowContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapHazardReportResponse(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  if (isRecord(value.report)) {
    return value.report;
  }

  if (isRecord(value.data)) {
    return value.data;
  }

  return value;
}

function readHazardReportList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (Array.isArray(value.reports)) {
    return value.reports;
  }

  if (value.data !== value) {
    return readHazardReportList(value.data);
  }

  return [];
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

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null;
}

function asStatus(value: unknown): HazardWorkflowStatus | null {
  return value === 'Reported' ||
    value === 'Investigating' ||
    value === 'Corrective Action' ||
    value === 'Closed'
    ? value
    : null;
}

function asHazardCategoryName(
  value: unknown,
  fallback: HazardCategoryName,
): HazardCategoryName {
  return value === 'Machinery' ||
    value === 'Chemical' ||
    value === 'Electrical' ||
    value === 'Ergonomic' ||
    value === 'Slip/Trip/Fall' ||
    value === 'Fire' ||
    value === 'Biological'
    ? value
    : fallback;
}

function asSeverityLevelName(
  value: unknown,
  fallback: SeverityLevelName,
): SeverityLevelName {
  return value === 'Low' ||
    value === 'Medium' ||
    value === 'High' ||
    value === 'Critical'
    ? value
    : fallback;
}

function buildReportId() {
  return `haz-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

function buildDueDateError(): NormalizedApiError {
  return {
    status: 400,
    message: 'Due date cannot be in the past.',
    fieldErrors: {
      dueDate: ['Due date cannot be in the past.'],
    },
  };
}

function buildPermissionError(message: string): NormalizedApiError {
  return {
    status: 403,
    message,
  };
}

function buildSectionId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeInvestigationDetail(
  value: unknown,
  fallbackDate: string | null,
): InvestigationDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const findings = readStringValue(value.findings) || readStringValue(value.notes);
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

  if (!findings && !rootCause && contributingFactors.length === 0 && !investigationDate) {
    return null;
  }

  return {
    id: readStringValue(value.id) || buildSectionId('inv'),
    findings,
    rootCause,
    contributingFactors,
    investigationDate,
  };
}

function normalizeCorrectiveAction(
  value: unknown,
): CorrectiveActionRecord | null {
  if (typeof value === 'string') {
    const actionDescription = value.trim();
    if (!actionDescription) {
      return null;
    }

    return {
      id: buildSectionId('ca'),
      actionDescription,
      responsiblePerson: '',
      dueDate: '',
      completed: false,
      createdAt: nowIsoString(),
      updatedAt: null,
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
      buildSectionId('ca'),
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
      nowIsoString(),
    updatedAt:
      readStringValue(value.updatedAt) || readStringValue(value.updated_at) || null,
  };
}

function normalizeClosureRecord(
  value: unknown,
  fallbackDate: string | null,
): ClosureRecord | null {
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
    id: readStringValue(value.id) || buildSectionId('cl'),
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
    .filter((item): item is CorrectiveActionRecord => item !== null);
}

function sameCorrectiveAction(
  action: CorrectiveActionRecord,
  payload: CorrectiveActionRequest,
) {
  return (
    action.actionDescription.trim() === payload.actionDescription.trim() &&
    action.responsiblePerson.trim() === payload.responsiblePerson.trim() &&
    action.dueDate.trim() === payload.dueDate.trim() &&
    action.completed === Boolean(payload.completed)
  );
}

function normalizeCreatedCorrectiveAction(
  responseData: unknown,
  payload: CorrectiveActionRequest,
) {
  const directAction = normalizeCorrectiveAction(responseData);
  if (directAction) {
    return directAction;
  }

  if (!isRecord(responseData)) {
    return null;
  }

  const candidates = [
    responseData.correctiveAction,
    responseData.correctiveActionRecord,
    responseData.correctiveActionCreated,
    responseData.action,
    responseData.record,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCorrectiveAction(candidate);
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  const candidateLists = [
    responseData.correctiveActions,
    responseData.correctiveActionRecords,
  ];

  for (const candidateList of candidateLists) {
    const normalizedList = normalizeCorrectiveActionList(candidateList);
    const matchingAction =
      normalizedList.find((action) => sameCorrectiveAction(action, payload)) ??
      normalizedList[normalizedList.length - 1] ??
      null;

    if (matchingAction) {
      return matchingAction;
    }
  }

  return null;
}

function normalizeHazardReport(
  raw: unknown,
  fallback: CreateHazardReportDraft,
): HazardReportRecord {
  const record = isRecord(raw) ? raw : {};
  const createdAt =
    readStringValue(record.createdAt) ||
    readStringValue(record.created_at) ||
    readStringValue(record.dateReported) ||
    readStringValue(record.reportedAt) ||
    nowIsoString();
  const updatedAt =
    readStringValue(record.updatedAt) ||
    readStringValue(record.updated_at) ||
    readStringValue(record.modifiedAt) ||
    createdAt;
  const investigationDetail =
    normalizeInvestigationDetail(record.investigationDetail, null) ??
    normalizeInvestigationDetail(record.investigationRecord, null);
  const closureRecord =
    normalizeClosureRecord(record.closureRecord, null) ??
    normalizeClosureRecord(
      {
        id: record.closureRecordId,
        closureDate: record.closureDate,
        closedAt: record.closedAt,
        closureNotes: record.closureNote,
        effectivenessCheck: record.effectivenessCheck,
        notes: record.closureNote,
      },
      null,
    );
  const correctiveActions = [
    ...normalizeCorrectiveActionList(record.correctiveActions),
    ...normalizeCorrectiveActionList(record.correctiveActionRecords),
  ];

  return {
    id: readStringValue(record.id) || buildReportId(),
    title:
      readStringValue(record.title) ||
      readStringValue(record.subject) ||
      readStringValue(record.name) ||
      fallback.title,
    summary:
      readStringValue(record.summary) ||
      readStringValue(record.description) ||
      readStringValue(record.details) ||
      fallback.summary,
    location:
      readStringValue(record.location, ['name', 'label', 'title', 'address']) ||
      readStringValue(record.place, ['name', 'label', 'title', 'address']) ||
      readStringValue(record.siteLocation) ||
      readStringValue(record.workLocation) ||
      fallback.location,
    createdById: getHazardCreatorId({
      createdById: record.createdById,
      reporterId: record.reporterId,
      userId: record.userId,
      authorId: record.authorId,
      creatorId: record.creatorId,
      createdBy: record.createdBy,
      reporter: record.reporter,
      author: record.author,
      user: record.user,
    }),
    hazardCategory: asHazardCategoryName(
      readStringValue(record.hazardCategory, ['name', 'label', 'title']) ||
        readStringValue(record.category, ['name', 'label', 'title']) ||
        readStringValue(record.hazardCategoryName, ['name', 'label', 'title']) ||
        readStringValue(record.categoryName, ['name', 'label', 'title']),
      fallback.hazardCategory,
    ),
    severityLevel: asSeverityLevelName(
      readStringValue(record.severityLevel, ['name', 'level', 'label']) ||
        readStringValue(record.severity, ['name', 'level', 'label']) ||
        readStringValue(record.severityLevelName, ['name', 'level', 'label']) ||
        readStringValue(record.severityName, ['name', 'level', 'label']),
      fallback.severityLevel,
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
    status:
      asStatus(record.status) ??
      asStatus(record.workflowStatus) ??
      asStatus(record.reportStatus) ??
      'Reported',
    assignedOfficerId:
      asNullableString(record.assignedOfficerId) ??
      asNullableString(record.assignedTo) ??
      asNullableString(record.assignedToId),
    assignedOfficer:
      isRecord(record.assignedOfficer) || isRecord(record.assignedTo)
        ? {
            id:
              readStringValue(record.assignedOfficer, ['id']) ||
              readStringValue(record.assignedTo, ['id']) ||
              null,
            fullName:
              readStringValue(record.assignedOfficer, ['fullName', 'name']) ||
              readStringValue(record.assignedTo, ['fullName', 'name']) ||
              null,
            jobTitle:
              readStringValue(record.assignedOfficer, ['jobTitle', 'title']) ||
              readStringValue(record.assignedTo, ['jobTitle', 'title']) ||
              null,
          }
        : null,
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

function upsertReport(
  currentReports: HazardReportRecord[],
  nextReport: HazardReportRecord,
) {
  const index = currentReports.findIndex((report) => report.id === nextReport.id);

  if (index === -1) {
    return [nextReport, ...currentReports];
  }

  const nextReports = [...currentReports];
  nextReports[index] = nextReport;
  return nextReports;
}

function deriveNextTimestamp(existing: HazardReportRecord) {
  return new Date().toISOString() || existing.updatedAt;
}

function hazardReportsReducer(
  currentReports: HazardReportRecord[],
  action: HazardReportsAction,
) {
  switch (action.type) {
    case 'reports/replace':
      return action.reports;
    case 'report/created':
    case 'report/assigned':
    case 'report/investigated':
    case 'report/corrective-action-added':
    case 'report/corrective-action-updated':
    case 'report/closed':
      return upsertReport(currentReports, action.report);
    default:
      return currentReports;
  }
}

export function HazardWorkflowProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { currentUser } = useAuth();
  const [reports, dispatch] = useReducer(
    hazardReportsReducer,
    [],
  );
  const reportsRef = useRef(reports);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  const getReportById = useCallback(
    (id: string) => reports.find((report) => report.id === id) ?? null,
    [reports],
  );

  const replaceReports = useCallback((nextReports: HazardReportRecord[]) => {
    dispatch({ type: 'reports/replace', reports: nextReports });
  }, []);

  const fetchHazardReports = useCallback(async () => {
    const response = await apiClient.get<unknown>('/hazard-reports', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    const nextReports = readHazardReportList(response.data).map((report) =>
      normalizeHazardReport(report, {
        title: '',
        summary: '',
        location: '',
        hazardCategory: 'Machinery',
        severityLevel: 'Low',
      }),
    );

    dispatch({ type: 'reports/replace', reports: nextReports });
    return nextReports;
  }, []);

  const fetchHazardReport = useCallback(async (id: string) => {
    const response = await apiClient.get<unknown>(`/hazard-reports/${id}`);
    const nextReport = normalizeHazardReport(
      unwrapHazardReportResponse(response.data),
      {
        title: '',
        summary: '',
        location: '',
        hazardCategory: 'Machinery',
        severityLevel: 'Low',
      },
    );

    dispatch({ type: 'report/created', report: nextReport });
    return nextReport;
  }, []);

  const createHazardReport = useCallback(
    async (payload: CreateHazardReportRequest, draft: CreateHazardReportDraft) => {
      const response = await apiClient.post<unknown>('/hazard-reports', payload);
      const nextReport = {
        ...normalizeHazardReport(response.data, draft),
        createdById: currentUser?.id ?? '',
      };

      dispatch({ type: 'report/created', report: nextReport });
      toast.success('Hazard reported successfully.');
      return nextReport;
    },
    [currentUser?.id],
  );

  const assignHazardReport = useCallback(
    async (id: string, payload: AssignHazardReportRequest) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      await apiClient.patch(`/hazard-reports/${id}/assign`, payload);

      const nextReport: HazardReportRecord = {
        ...currentReport,
        assignedOfficerId: payload.assignedOfficerId.trim(),
        updatedAt: deriveNextTimestamp(currentReport),
      };

      dispatch({ type: 'report/assigned', report: nextReport });

      toast.success('Hazard assigned successfully.');
      return nextReport;
    },
    [],
  );

  const updateHazardReportStatus = useCallback(
    async (id: string, payload: UpdateHazardReportStatusRequest) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      if (currentUser?.role !== 'manager') {
        throw buildPermissionError('Only managers can change report status.');
      }

      await apiClient.patch(`/hazard-reports/${id}/status`, payload);
      const nextReport = {
        ...currentReport,
        status: payload.status,
        updatedAt: deriveNextTimestamp(currentReport),
      };
      dispatch({ type: 'report/assigned', report: nextReport });
      toast.success('Hazard status updated successfully.');
      return nextReport;
    },
    [currentUser?.role],
  );

  const investigateHazardReport = useCallback(
    async (id: string, payload: InvestigateHazardReportRequest) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      const currentUserId = String(currentUser?.id ?? '').trim();
      const assignedOfficerId = String(
        currentReport.assignedOfficer?.id ?? currentReport.assignedOfficerId ?? '',
      ).trim();
      const canUpdateInvestigation =
        currentUser?.role === 'manager' ||
        (currentUser?.role === 'safety_officer' &&
        currentUserId.length > 0 &&
        currentUserId === assignedOfficerId);

      if (currentReport.status === 'Closed') {
        throw buildPermissionError(
          'Closed hazard reports cannot be updated.',
        );
      }

      if (!canUpdateInvestigation) {
        throw buildPermissionError(
          'Only the assigned safety officer can record investigation details.',
        );
      }

      await apiClient.post(`/hazard-reports/${id}/investigate`, payload);

      const nextReport: HazardReportRecord = {
        ...currentReport,
        status: 'Corrective Action',
        investigationNotes: [
          `Findings: ${payload.findings.trim()}`,
          `Root cause: ${payload.rootCause.trim()}`,
          payload.contributingFactors.length > 0
            ? `Contributing factors: ${payload.contributingFactors
                .map((factor) => factor.trim())
                .filter(Boolean)
                .join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        investigationDetail: {
          id: currentReport.investigationDetail?.id || buildSectionId('inv'),
          findings: payload.findings.trim(),
          rootCause: payload.rootCause.trim(),
          contributingFactors: payload.contributingFactors
            .map((factor) => factor.trim())
            .filter(Boolean),
          investigationDate:
            currentReport.investigationDetail?.investigationDate ?? nowIsoString(),
        },
        updatedAt: deriveNextTimestamp(currentReport),
      };

      dispatch({ type: 'report/investigated', report: nextReport });

      toast.success('Investigation saved successfully.');
      return nextReport;
    },
    [currentUser?.id, currentUser?.role],
  );

  const addCorrectiveAction = useCallback(
    async (id: string, payload: CorrectiveActionRequest) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      const currentUserId = String(currentUser?.id ?? '').trim();
      const assignedOfficerId = String(
        currentReport.assignedOfficer?.id ?? currentReport.assignedOfficerId ?? '',
      ).trim();
      const canUpdateCorrectiveActions =
        currentUser?.role === 'manager' ||
        (currentUser?.role === 'safety_officer' &&
        currentUserId.length > 0 &&
        currentUserId === assignedOfficerId);

      if (currentReport.status === 'Closed') {
        throw buildPermissionError(
          'Closed hazard reports cannot be updated.',
        );
      }

      if (!canUpdateCorrectiveActions) {
        throw buildPermissionError(
          'Only the assigned safety officer can add corrective actions.',
        );
      }

      if (isPastDateInputValue(payload.dueDate)) {
        throw buildDueDateError();
      }

      const response = await apiClient.post<unknown>(
        `/hazard-reports/${id}/corrective-actions`,
        payload,
      );
      const createdAction =
        normalizeCreatedCorrectiveAction(response.data, payload) ?? {
          id: buildSectionId('ca'),
          actionDescription: payload.actionDescription.trim(),
          responsiblePerson: payload.responsiblePerson.trim(),
          dueDate: payload.dueDate,
          completed: Boolean(payload.completed),
          createdAt: nowIsoString(),
          updatedAt: null,
        };

      const nextReport: HazardReportRecord = {
        ...currentReport,
        status: 'Corrective Action',
        correctiveActions: [...currentReport.correctiveActions, createdAction],
        updatedAt: deriveNextTimestamp(currentReport),
      };

      dispatch({ type: 'report/corrective-action-added', report: nextReport });

      toast.success('Corrective action added successfully.');
      return nextReport;
    },
    [currentUser?.id, currentUser?.role],
  );

  const updateCorrectiveAction = useCallback(
    async (
      id: string,
      actionId: string,
      payload: UpdateCorrectiveActionRequest,
    ) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      const currentAction = currentReport.correctiveActions.find(
        (action) => action.id === actionId,
      );
      if (!currentAction) {
        throw new Error(`Corrective action ${actionId} was not found.`);
      }

      if (isPastDateInputValue(payload.dueDate)) {
        throw buildDueDateError();
      }

      await apiClient.patch(
        `/hazard-reports/${id}/corrective-actions/${actionId}`,
        payload,
      );

      const nextAction: CorrectiveActionRecord = {
        ...currentAction,
        actionDescription: payload.actionDescription.trim(),
        responsiblePerson: payload.responsiblePerson.trim(),
        dueDate: payload.dueDate,
        completed: Boolean(payload.completed),
        updatedAt: nowIsoString(),
      };

      const nextReport: HazardReportRecord = {
        ...currentReport,
        correctiveActions: currentReport.correctiveActions.map((action) =>
          action.id === actionId ? nextAction : action,
        ),
        updatedAt: deriveNextTimestamp(currentReport),
      };

      dispatch({ type: 'report/corrective-action-updated', report: nextReport });

      toast.success('Corrective action updated successfully.');
      return nextReport;
    },
    [],
  );

  const closeHazardReport = useCallback(
    async (id: string, payload: CloseHazardReportRequest) => {
      const currentReport = reportsRef.current.find((report) => report.id === id);
      if (!currentReport) {
        throw new Error(`Hazard report ${id} was not found.`);
      }

      const assignedOfficerId = String(
        currentReport.assignedOfficer?.id ?? currentReport.assignedOfficerId ?? '',
      ).trim();
      const canClose =
        currentUser?.role === 'manager' ||
        (currentUser?.role === 'safety_officer' &&
          String(currentUser.id).trim() === assignedOfficerId);

      if (!canClose) {
        throw buildPermissionError(
          'Only managers or the assigned safety officer can close hazard reports.',
        );
      }

      await apiClient.post(`/hazard-reports/${id}/close`, payload);

      const closedAt = new Date().toISOString();
      const nextReport: HazardReportRecord = {
        ...currentReport,
        status: 'Closed',
        closureRecord: {
          id: currentReport.closureRecord?.id || buildSectionId('cl'),
          closureDate: closedAt,
          closureNotes:
            [
              payload.closureNotes.trim(),
              payload.effectivenessCheck?.trim() ?? '',
            ]
              .filter(Boolean)
              .join('\n\n'),
          effectivenessCheck: payload.effectivenessCheck?.trim() || null,
        },
        closureNote:
          [
            payload.closureNotes.trim(),
            payload.effectivenessCheck?.trim() ?? '',
          ]
            .filter(Boolean)
            .join('\n\n') || null,
        closedAt,
        updatedAt: deriveNextTimestamp(currentReport),
      };

      dispatch({ type: 'report/closed', report: nextReport });

      toast.success('Hazard closed successfully.');
      return nextReport;
    },
    [currentUser],
  );

  return (
    <HazardWorkflowContext
      value={{
        reports,
        getReportById,
        replaceReports,
        fetchHazardReports,
        fetchHazardReport,
        createHazardReport,
        assignHazardReport,
        updateHazardReportStatus,
        investigateHazardReport,
        addCorrectiveAction,
        updateCorrectiveAction,
        closeHazardReport,
      }}
    >
      {children}
    </HazardWorkflowContext>
  );
}

export function useHazardWorkflow() {
  const context = use(HazardWorkflowContext);

  if (!context) {
    throw new Error(
      'useHazardWorkflow must be used within a HazardWorkflowProvider.',
    );
  }

  return context;
}
