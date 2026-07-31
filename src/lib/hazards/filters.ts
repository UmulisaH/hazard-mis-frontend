import type { HazardPriority, HazardWorkflowStatus } from './types';

export interface HazardReportFilters {
  search: string;
  status: HazardWorkflowStatus | '';
  aiPriority: HazardPriority | '';
  departmentId: string;
  hazardCategoryId: string;
  severityLevelId: string;
  assignedOfficerId: string;
  reporterId: string;
  fromDate: string;
  toDate: string;
}

export const EMPTY_HAZARD_REPORT_FILTERS: HazardReportFilters = {
  search: '',
  status: '',
  aiPriority: '',
  departmentId: '',
  hazardCategoryId: '',
  severityLevelId: '',
  assignedOfficerId: '',
  reporterId: '',
  fromDate: '',
  toDate: '',
};

export function buildHazardReportQuery(filters: HazardReportFilters) {
  const query = new URLSearchParams();
  const entries: Array<[keyof HazardReportFilters, string]> = [
    ['status', filters.status],
    ['aiPriority', filters.aiPriority],
    ['departmentId', filters.departmentId],
    ['hazardCategoryId', filters.hazardCategoryId],
    ['severityLevelId', filters.severityLevelId],
    ['assignedOfficerId', filters.assignedOfficerId],
    ['reporterId', filters.reporterId],
    ['search', filters.search],
    ['fromDate', filters.fromDate],
    ['toDate', filters.toDate],
  ];

  for (const [key, value] of entries) {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      query.set(key, trimmedValue);
    }
  }

  return query;
}

