import type { HazardCategoryName, SeverityLevelName } from '@/lib/ai/types';

export type HazardPriority = 'Low' | 'Medium' | 'High';

export type HazardWorkflowStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'Investigating'
  | 'Corrective Action'
  | 'Ready for Closure'
  | 'Resolved'
  | 'Closed';

export interface HazardCategoryOption {
  id: string;
  name: HazardCategoryName;
  description: string | null;
  parentId: string | null;
}

export interface SeverityLevelOption {
  id: string;
  name: SeverityLevelName;
  weight: number;
  description: string | null;
}

export interface HazardUserOption {
  id: string;
  fullName: string;
  jobTitle: string;
  isSafetyOfficer: boolean;
  isAdmin: boolean;
}

export interface InvestigationDetail {
  id: string;
  findings: string;
  rootCause: string;
  contributingFactors: string[];
  investigationDate: string | null;
}

export interface CorrectiveActionRecord {
  id: string;
  actionDescription: string;
  responsiblePerson: string;
  dueDate: string;
  completed: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ClosureRecord {
  id: string;
  closureDate: string;
  closureNotes: string;
  effectivenessCheck: string | null;
}

export interface HazardReport {
  id: string;
  title: string;
  summary: string;
  location: string;
  createdById: string;
  hazardCategory: HazardCategoryName;
  severityLevel: SeverityLevelName;
  status: HazardWorkflowStatus;
  assignedOfficerId: string | null;
  assignedOfficer?: {
    id?: string | number | null;
    fullName?: string | null;
    jobTitle?: string | null;
  } | null;
  investigationDetail: InvestigationDetail | null;
  correctiveActions: CorrectiveActionRecord[];
  closureRecord: ClosureRecord | null;
  investigationNotes: string | null;
  closureNote: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type HazardReportRecord = HazardReport;

export interface CreateHazardReportDraft {
  title: string;
  summary: string;
  location: string;
  hazardCategory: HazardCategoryName;
  severityLevel: SeverityLevelName;
}

export interface CreateHazardReportRequest {
  title: string;
  description: string;
  hazardCategoryId: string;
  severityLevelId: string;
  aiPriority?: HazardPriority;
  aiConfidence?: number;
}

export interface AssignHazardReportRequest {
  assignedOfficerId: string;
}

export interface InvestigateHazardReportRequest {
  findings: string;
  rootCause: string;
  contributingFactors: string[];
}

export interface CorrectiveActionRequest {
  actionDescription: string;
  responsiblePerson: string;
  dueDate: string;
  completed?: boolean;
}

export interface UpdateCorrectiveActionRequest {
  actionDescription: string;
  responsiblePerson: string;
  dueDate: string;
  completed?: boolean;
}

export interface CloseHazardReportRequest {
  closureNotes: string;
  effectivenessCheck?: string;
}

export function getHazardCreatorId(
  report: {
    createdById?: unknown;
    reporterId?: unknown;
    userId?: unknown;
    authorId?: unknown;
    creatorId?: unknown;
    creator?: unknown;
    reporter?: unknown;
    author?: unknown;
    user?: unknown;
    createdBy?: unknown;
  } | Record<string, unknown>,
) {
  function readId(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      const nestedId = record.id ?? record.userId ?? record.reporterId;

      if (typeof nestedId === 'string' || typeof nestedId === 'number') {
        return String(nestedId);
      }
    }

    return '';
  }

  return (
    readId(report.createdById) ||
    readId(report.reporterId) ||
    readId(report.userId) ||
    readId(report.authorId) ||
    readId(report.creatorId) ||
    readId(report.createdBy) ||
    readId(report.reporter) ||
    readId(report.author) ||
    readId(report.user) ||
    ''
  );
}
