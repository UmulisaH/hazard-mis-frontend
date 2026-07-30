'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

import { FieldError, FormAlert } from '@/components/auth/form-feedback';
import { useAuth } from '@/lib/auth/auth-context';
import { useHazardWorkflow } from './hazard-workflow-provider';
import { useSafetyOfficers } from './use-safety-officers';
import type { HazardReportRecord } from '@/lib/hazards/types';
import type { NormalizedApiError } from '@/lib/api/types';

function isTerminalStatus(status: HazardReportRecord['status']) {
  return status === 'Closed';
}

function Shell({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ModalShell({
  eyebrow,
  title,
  description,
  onClose,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-4xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function ClosureModal({
  reportId,
  isOpen,
  onClose,
}: Readonly<{
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const { closeHazardReport } = useHazardWorkflow();
  const [closureNotes, setClosureNotes] = useState('');
  const [effectivenessCheck, setEffectivenessCheck] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<NormalizedApiError | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldError(null);

    try {
      await closeHazardReport(reportId, {
        closureNotes: closureNotes.trim(),
        effectivenessCheck: effectivenessCheck.trim() || undefined,
      });
      onClose();
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
    <ModalShell
      eyebrow="Record closure"
      title="Close record"
      description="Confirm the corrective work is complete and close the hazard."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Closure notes
          <textarea
            value={closureNotes}
            onChange={(event) => setClosureNotes(event.target.value)}
            className="mt-2 min-h-32 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError message={fieldError?.fieldErrors?.closureNotes?.[0]} />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Effectiveness check
          <textarea
            value={effectivenessCheck}
            onChange={(event) => setEffectivenessCheck(event.target.value)}
            className="mt-2 min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
          />
          <FieldError
            message={fieldError?.fieldErrors?.effectivenessCheck?.[0]}
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? 'Closing...' : 'Close record'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AssignmentModal({
  report,
  officers,
  isLoadingOfficers,
  officerError,
  onClose,
}: Readonly<{
  report: HazardReportRecord;
  officers: Array<{
    id: string;
    fullName: string;
    jobTitle: string;
  }>;
  isLoadingOfficers: boolean;
  officerError: string | null;
  onClose: () => void;
}>) {
  const { assignHazardReport } = useHazardWorkflow();
  const currentAssignedOfficerId = String(
    report.assignedOfficer?.id ?? report.assignedOfficerId ?? '',
  ).trim();
  const eligibleAssignedOfficerId = officers.some(
    (officer) => officer.id === currentAssignedOfficerId,
  )
    ? currentAssignedOfficerId
    : '';
  const [assignedOfficerId, setAssignedOfficerId] = useState(
    eligibleAssignedOfficerId,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<NormalizedApiError | null>(null);
  const currentAssignee = officers.find(
    (officer) => officer.id === currentAssignedOfficerId,
  );
  const assigneeName =
    report.assignedOfficer?.fullName || currentAssignee?.fullName || null;
  const assigneeJobTitle =
    report.assignedOfficer?.jobTitle || currentAssignee?.jobTitle || null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldError(null);

    try {
      await assignHazardReport(report.id, {
        assignedOfficerId: assignedOfficerId.trim(),
      });
      onClose();
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

  const hasEligibleOfficers = officers.length > 0;
  const selectedOfficer = officers.find((officer) => officer.id === assignedOfficerId);
  const canSubmit = hasEligibleOfficers && assignedOfficerId.trim().length > 0;

  return (
    <ModalShell
      eyebrow="Report assignment"
      title="Assign safety officer"
      description="Select a safety officer to take ownership of this hazard report."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        {officerError ? (
          <FormAlert tone="info">{officerError}</FormAlert>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">Current assignee</p>
          <p className="mt-1">
            {assigneeName
              ? `${assigneeName}${assigneeJobTitle ? `, ${assigneeJobTitle}` : ''}`
              : currentAssignedOfficerId
                ? 'Assigned officer is no longer in the eligible list.'
                : 'Unassigned'}
          </p>
        </div>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Safety officer
          <select
            value={assignedOfficerId}
            onChange={(event) => setAssignedOfficerId(event.target.value)}
            disabled={isLoadingOfficers || !hasEligibleOfficers}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
            required
          >
            <option value="" disabled>
              {isLoadingOfficers
                ? 'Loading safety officers...'
                : hasEligibleOfficers
                  ? 'Select a safety officer'
                  : 'No eligible safety officers available'}
            </option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.fullName}
                {officer.jobTitle ? ` - ${officer.jobTitle}` : ''}
              </option>
            ))}
          </select>
          <FieldError message={fieldError?.fieldErrors?.assignedOfficerId?.[0]} />
          <p className="mt-2 text-xs leading-5 text-slate-500">
          Only users with safety officer access and no admin role are listed.
          </p>
        </label>

        {selectedOfficer ? (
          <p className="text-xs leading-5 text-slate-500">
            Selected: {selectedOfficer.fullName}
            {selectedOfficer.jobTitle ? `, ${selectedOfficer.jobTitle}` : ''}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? 'Assigning...' : 'Assign report'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function HazardLifecycleActions({
  report,
}: Readonly<{
  report: HazardReportRecord;
}>) {
  const { currentUser } = useAuth();
  const { officers, isLoading: isLoadingOfficers, error: officerError } =
    useSafetyOfficers(Boolean(currentUser?.isAdmin));
  const [closureOpen, setClosureOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const assignedOfficerId = String(
    report.assignedOfficer?.id ?? report.assignedOfficerId ?? '',
  ).trim();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const isClosed = isTerminalStatus(report.status);
  const canClose = isAdmin;
  const canAssign = isAdmin && !isClosed;
  const currentAssignee = officers.find((officer) => officer.id === assignedOfficerId);
  const assigneeName =
    report.assignedOfficer?.fullName || currentAssignee?.fullName || null;
  const assigneeJobTitle =
    report.assignedOfficer?.jobTitle || currentAssignee?.jobTitle || null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Shell
        title="Report assignment"
        description={
          isClosed
            ? 'This hazard is already closed.'
            : 'Assign or reassign the report to an eligible safety officer.'
        }
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-slate-950">Current assignee</p>
            <p className="mt-1">
              {assigneeName
                ? `${assigneeName}${assigneeJobTitle ? `, ${assigneeJobTitle}` : ''}`
                : assignedOfficerId
                  ? 'Assigned officer is not in the eligible list.'
                  : 'Unassigned'}
            </p>
          </div>

          {canAssign ? (
            <button
              type="button"
              onClick={() => setAssignmentOpen(true)}
              className="inline-flex w-fit rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Assign officer
            </button>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              Only admins can assign or reassign hazard reports.
            </p>
          )}
        </div>

        {canAssign && assignmentOpen ? (
          <AssignmentModal
            report={report}
            officers={officers}
            isLoadingOfficers={isLoadingOfficers}
            officerError={officerError}
            onClose={() => setAssignmentOpen(false)}
          />
        ) : null}
      </Shell>

      <Shell
        title="Record closure"
        description={isClosed ? 'This hazard is already closed.' : ''}
      >
        {isClosed ? (
          <p className="text-sm leading-6 text-slate-600">
            The record is in a terminal state.
          </p>
        ) : canClose ? (
          <button
            type="button"
            onClick={() => setClosureOpen(true)}
            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Close record
          </button>
        ) : (
          <p className="text-sm leading-6 text-slate-600">
            Only admins can close hazard reports.
          </p>
        )}

        {canClose && !isClosed ? (
          <ClosureModal
            reportId={report.id}
            isOpen={closureOpen}
            onClose={() => setClosureOpen(false)}
          />
        ) : null}
      </Shell>
    </div>
  );
}
