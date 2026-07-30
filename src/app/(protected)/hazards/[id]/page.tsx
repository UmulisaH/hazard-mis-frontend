'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';

import { FieldError, FormAlert } from '@/components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { HazardLifecycleActions } from '@/components/hazards/hazard-lifecycle-actions';
import { useAuth } from '@/lib/auth/auth-context';
import { useHazardWorkflow } from '@/components/hazards/hazard-workflow-provider';
import type { NormalizedApiError } from '@/lib/api/types';
import { getTodayDateInputValue } from '@/lib/hazards/date-input';
import type { CorrectiveActionRecord, HazardReportRecord } from '@/lib/hazards/types';

function getFieldError(error: NormalizedApiError | null, field: string) {
  return error?.fieldErrors?.[field]?.[0];
}

function ActionDialog({
  title,
  description,
  onClose,
  children,
}: Readonly<{
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
              Hazard workflow
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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDateOrFallback(value: string | null | undefined) {
  return value ? formatDate(value) : 'Pending';
}

function formatTextOrFallback(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : 'N/A';
}

function PendingPanel({
  title,
  description,
  action,
  emphasis = false,
}: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
  emphasis?: boolean;
}>) {
  return (
    <div
      className={`mt-5 rounded-2xl px-4 py-5 ${
        emphasis
          ? 'border border-sky-200 bg-sky-50/90 shadow-[0_14px_30px_rgba(14,165,233,0.12)]'
          : 'border border-dashed border-slate-200 bg-slate-50/80'
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          emphasis ? 'text-sky-950' : 'text-slate-950'
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-1 text-sm leading-6 ${
          emphasis ? 'text-sky-900' : 'text-slate-600'
        }`}
      >
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function CorrectiveActionEditorModal({
  reportId,
  action,
  isOpen,
  onClose,
}: Readonly<{
  reportId: string;
  action: CorrectiveActionRecord;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const { updateCorrectiveAction } = useHazardWorkflow();
  const [actionDescription, setActionDescription] = useState(
    action.actionDescription,
  );
  const [responsiblePerson, setResponsiblePerson] = useState(
    action.responsiblePerson,
  );
  const [dueDate, setDueDate] = useState(action.dueDate);
  const [completed, setCompleted] = useState(action.completed);
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
      await updateCorrectiveAction(reportId, action.id, {
        actionDescription: actionDescription.trim(),
        responsiblePerson: responsiblePerson.trim(),
        dueDate,
        completed,
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
    <ActionDialog
      title="Edit corrective action"
      description="Update the action owner, completion state, or due date."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Action description
          <input
            type="text"
            value={actionDescription}
            onChange={(event) => setActionDescription(event.target.value)}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError
            message={getFieldError(fieldError, 'actionDescription')}
          />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Responsible person
          <input
            type="text"
            value={responsiblePerson}
            onChange={(event) => setResponsiblePerson(event.target.value)}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError
            message={getFieldError(fieldError, 'responsiblePerson')}
          />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            min={getTodayDateInputValue()}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError message={getFieldError(fieldError, 'dueDate')} />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Select today or a future date.
          </p>
        </label>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={completed}
            onChange={(event) => setCompleted(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-950"
          />
          Mark as completed
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
            {isSubmitting ? 'Saving...' : 'Save corrective action'}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

function InvestigationEditorModal({
  reportId,
  isOpen,
  onClose,
}: Readonly<{
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const { investigateHazardReport } = useHazardWorkflow();
  const [findings, setFindings] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [contributingFactors, setContributingFactors] = useState('');
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

    const nextFactors = contributingFactors
      .split(/[\n,]/)
      .map((factor) => factor.trim())
      .filter(Boolean);

    try {
      await investigateHazardReport(reportId, {
        findings: findings.trim(),
        rootCause: rootCause.trim(),
        contributingFactors: nextFactors,
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
    <ActionDialog
      title="Record investigation"
      description="Capture the findings, root cause, and contributing factors for this hazard."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Findings
          <textarea
            value={findings}
            onChange={(event) => setFindings(event.target.value)}
            className="mt-2 min-h-32 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError message={fieldError?.fieldErrors?.findings?.[0]} />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Root cause
          <textarea
            value={rootCause}
            onChange={(event) => setRootCause(event.target.value)}
            className="mt-2 min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError message={fieldError?.fieldErrors?.rootCause?.[0]} />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Contributing factors
          <textarea
            value={contributingFactors}
            onChange={(event) => setContributingFactors(event.target.value)}
            className="mt-2 min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            placeholder="Separate factors with commas or new lines"
          />
          <FieldError
            message={fieldError?.fieldErrors?.contributingFactors?.[0]}
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
            {isSubmitting ? 'Saving...' : 'Save investigation'}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

function CorrectiveActionCreatorModal({
  reportId,
  isOpen,
  onClose,
}: Readonly<{
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}>) {
  const { addCorrectiveAction } = useHazardWorkflow();
  const [actionDescription, setActionDescription] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [dueDate, setDueDate] = useState(getTodayDateInputValue());
  const [completed, setCompleted] = useState(false);
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
      await addCorrectiveAction(reportId, {
        actionDescription: actionDescription.trim(),
        responsiblePerson: responsiblePerson.trim(),
        dueDate,
        completed,
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
    <ActionDialog
      title="Add corrective action"
      description="Capture the action plan needed to reduce the hazard risk."
      onClose={onClose}
    >
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Action description
          <input
            type="text"
            value={actionDescription}
            onChange={(event) => setActionDescription(event.target.value)}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError
            message={fieldError?.fieldErrors?.actionDescription?.[0]}
          />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Responsible person
          <input
            type="text"
            value={responsiblePerson}
            onChange={(event) => setResponsiblePerson(event.target.value)}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError
            message={fieldError?.fieldErrors?.responsiblePerson?.[0]}
          />
        </label>

        <label className="flex flex-col text-sm font-medium text-slate-700">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            min={getTodayDateInputValue()}
            className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
            required
          />
          <FieldError message={fieldError?.fieldErrors?.dueDate?.[0]} />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Select today or a future date.
          </p>
        </label>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={completed}
            onChange={(event) => setCompleted(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-950"
          />
          Mark as completed
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
            {isSubmitting ? 'Saving...' : 'Save corrective action'}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

function LifecycleDetails({
  report,
  canEditCorrectiveActions,
  canAddInvestigation,
  canAddCorrectiveAction,
}: Readonly<{
  report: HazardReportRecord;
  canEditCorrectiveActions: boolean;
  canAddInvestigation: boolean;
  canAddCorrectiveAction: boolean;
}>) {
  const investigation = report.investigationDetail;
  const correctiveActions = Array.isArray(report.correctiveActions)
    ? report.correctiveActions
    : [];
  const closureRecord = report.closureRecord;
  const [addingInvestigation, setAddingInvestigation] =
    useState(false);
  const [addingCorrectiveAction, setAddingCorrectiveAction] =
    useState(false);
  const [editingAction, setEditingAction] =
    useState<CorrectiveActionRecord | null>(null);

  return (
    <>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Investigation
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Investigation detail
              </h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {investigation ? 'Recorded' : 'Pending'}
              </span>
            </div>
          </div>

          {investigation ? (
            <dl className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Findings
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {formatTextOrFallback(investigation.findings)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Root cause
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {formatTextOrFallback(investigation.rootCause)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Contributing factors
                </dt>
                <dd className="mt-3 flex flex-wrap gap-2">
                  {investigation.contributingFactors.length > 0 ? (
                    investigation.contributingFactors.map((factor) => (
                      <span
                        key={factor}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900"
                      >
                        {factor}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">None recorded</span>
                  )}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Investigation date
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-950">
                  {formatDateOrFallback(investigation.investigationDate)}
                </dd>
              </div>
            </dl>
          ) : (
            <PendingPanel
              emphasis
              title="Add investigation detail"
              description="Record the findings and root cause before corrective actions are added."
              action={
                canAddInvestigation ? (
                  <button
                    type="button"
                    onClick={() => setAddingInvestigation(true)}
                    className="inline-flex rounded-full bg-sky-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900"
                  >
                    Add investigation detail
                  </button>
                ) : null
              }
            />
          )}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Corrective actions
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Action log
              </h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {correctiveActions.length > 0
                  ? correctiveActions.length
                  : 'Pending'}
              </span>
              {canAddCorrectiveAction ? (
                <button
                  type="button"
                  onClick={() => setAddingCorrectiveAction(true)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Add corrective action
                </button>
              ) : null}
            </div>
          </div>

          {correctiveActions.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {correctiveActions.map((action) => (
                <article
                  key={action.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-950">
                      {action.actionDescription}
                    </h4>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        action.completed
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      {action.completed ? 'Completed' : 'In progress'}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Responsible person
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {formatTextOrFallback(action.responsiblePerson)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Due date
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {formatDateOrFallback(action.dueDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Created at
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {formatDate(action.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Action ID
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {action.id}
                      </dd>
                    </div>
                  </dl>
                  {canEditCorrectiveActions ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingAction(action)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit corrective action
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <PendingPanel
              title="Pending Corrective Actions"
              description="No corrective actions have been added yet."
            />
          )}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Closure record
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">
                Final closure
              </h3>
            </div>
          </div>

          {closureRecord ? (
            <dl className="mt-5 grid gap-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Closure date
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-950">
                  N/A
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Closure notes
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {formatTextOrFallback(closureRecord.closureNotes)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Effectiveness check
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {formatTextOrFallback(closureRecord.effectivenessCheck)}
                </dd>
              </div>
            </dl>
          ) : (
            <PendingPanel
              title="Pending Closure"
              description="The hazard has not been closed yet."
            />
          )}
        </section>
      </div>

      {editingAction ? (
        <CorrectiveActionEditorModal
          key={editingAction.id}
          reportId={report.id}
          action={editingAction}
          isOpen={Boolean(editingAction)}
          onClose={() => setEditingAction(null)}
        />
      ) : null}
      {addingInvestigation ? (
        <InvestigationEditorModal
          reportId={report.id}
          isOpen={addingInvestigation}
          onClose={() => setAddingInvestigation(false)}
        />
      ) : null}
      {addingCorrectiveAction ? (
        <CorrectiveActionCreatorModal
          reportId={report.id}
          isOpen={addingCorrectiveAction}
          onClose={() => setAddingCorrectiveAction(false)}
        />
      ) : null}
    </>
  );
}

export default function HazardDetailPage() {
  const params = useParams<{ id: string }>();
  const { role, currentUser } = useAuth();
  const { getReportById } = useHazardWorkflow();
  const reportId = params.id;
  const report = getReportById(reportId);
  const currentUserId = String(currentUser?.id ?? '').trim();
  const assignedOfficerId = String(
    report?.assignedOfficer?.id ?? report?.assignedOfficerId ?? '',
  ).trim();
  const isClosed = report?.status === 'Closed';
  const canEditCorrectiveActions =
    role === 'Safety Officer' &&
    Boolean(currentUser?.isSafetyOfficer) &&
    currentUserId.length > 0 &&
    currentUserId === assignedOfficerId &&
    !isClosed;
  const canAddInvestigation = canEditCorrectiveActions;
  const canAddCorrectiveAction =
    canEditCorrectiveActions && Boolean(report?.investigationDetail);

  return (
    <RouteShell
      eyebrow="Hazard detail"
      title="Hazard record summary"
      description="Review the record details and closure state."
    >
      {report ? (
        <>
          <section
            className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.82)), url('/auth-workspace.svg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.25fr_0.75fr] md:px-8 md:py-10">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                    {report.status}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    {report.severityLevel}
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {report.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  {report.summary}
                </p>
              </div>

              <div className="grid gap-3 self-end">
                <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Record ID
                  </p>
                  <p className="mt-2 break-words text-sm font-medium text-white">
                    {report.id}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Updated
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatDate(report.updatedAt)}
                  </p>
                </div>
                <Link
                  href="/hazards"
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Back to workflow overview
                </Link>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Hazard Category
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-950">
                    {report.hazardCategory}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Location
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-950">
                    {report.location}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Created
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-950">
                    {formatDate(report.createdAt)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Updated
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-slate-950">
                    {formatDate(report.updatedAt)}
                  </dd>
                </div>
              </dl>
            </section>

            <aside className="grid gap-4">
              <div className="rounded-3xl border border-black/10 bg-white/90 p-6 text-sm leading-6 text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Status
                </p>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {report.status}
                </p>
              </div>
              <div className="rounded-3xl border border-black/10 bg-emerald-50 p-6 text-sm leading-6 text-emerald-950 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-900">
                  Closure
                </p>
                <p className="mt-3">
                  {report.closureRecord ? 'Closed record' : 'Open record'}
                </p>
              </div>
            </aside>
          </div>

          <LifecycleDetails
            report={report}
            canEditCorrectiveActions={canEditCorrectiveActions}
            canAddInvestigation={canAddInvestigation}
            canAddCorrectiveAction={canAddCorrectiveAction}
          />

          <div className="mt-6">
            <HazardLifecycleActions report={report} />
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-black/10 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Record unavailable
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              No local hazard record found
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              This detail view can only render records currently present in the
              shared client-side workflow store.
            </p>
          </section>
          <aside className="grid gap-4">
            <div className="rounded-3xl border border-black/10 bg-slate-50 p-6 text-sm leading-6 text-slate-700">
              Create a report to populate this view.
            </div>
            <Link
              href="/hazards/new"
              className="rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create a report
            </Link>
          </aside>
        </div>
      )}
    </RouteShell>
  );
}
