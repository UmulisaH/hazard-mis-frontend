'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { usePathname } from 'next/navigation';

import { RequireRole } from '@/components/auth/require-role';
import { FieldError, FormAlert } from '@/components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import { toast } from 'sonner';

interface InstitutionRecord {
  id: string;
  name: string;
  rssbCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentRecord {
  id: string;
  name: string;
  description: string | null;
  institutionId: string | null;
  institution?: {
    id: string;
    name: string;
  } | null;
  institutionName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InstitutionFormState {
  name: string;
  rssbCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
}

interface DepartmentFormState {
  name: string;
  institutionId: string;
  description: string;
}

type EntityMode = 'create' | 'edit';

type InstitutionModalState = {
  mode: EntityMode;
  record: InstitutionRecord | null;
};

type DepartmentModalState = {
  mode: EntityMode;
  record: DepartmentRecord | null;
};

type DeleteTarget =
  | { kind: 'institution'; record: InstitutionRecord }
  | { kind: 'department'; record: DepartmentRecord };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null;
}

function normalizeList<T>(
  data: unknown,
  mapItem: (item: unknown) => T,
): T[] {
  if (Array.isArray(data)) {
    return data.map(mapItem);
  }

  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items.map(mapItem);
  }

  return [];
}

function normalizeInstitution(raw: unknown): InstitutionRecord {
  const record = isRecord(raw) ? raw : {};

  return {
    id: asString(record.id),
    name: asString(record.name),
    rssbCode: asString(record.rssbCode),
    address: asString(record.address),
    contactPhone: asString(record.contactPhone),
    contactEmail: asString(record.contactEmail),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function normalizeDepartment(raw: unknown): DepartmentRecord {
  const record = isRecord(raw) ? raw : {};
  const institution = isRecord(record.institution) ? record.institution : null;

  return {
    id: asString(record.id),
    name: asString(record.name),
    description: asNullableString(record.description),
    institutionId: asNullableString(record.institutionId),
    institution: institution
      ? {
          id: asString(institution.id),
          name: asString(institution.name),
        }
      : null,
    institutionName: asNullableString(record.institutionName),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

function emptyInstitutionForm(): InstitutionFormState {
  return {
    name: '',
    rssbCode: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
  };
}

function emptyDepartmentForm(): DepartmentFormState {
  return {
    name: '',
    institutionId: '',
    description: '',
  };
}

function fieldErrorMessage(
  error: NormalizedApiError | null,
  field: string,
) {
  return error?.fieldErrors?.[field]?.[0];
}

function formatDate(value: string) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ModalShell({
  title,
  description,
  onClose,
  children,
  wide = false,
}: Readonly<{
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full rounded-4xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Organization
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

function SectionCard({
  title,
  description,
  actionLabel,
  actionDisabled,
  onAction,
  children,
}: Readonly<{
  title: string;
  description: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className="overflow-hidden rounded-3xl border border-black/10 bg-white">
      <div className="flex flex-col gap-4 border-b border-black/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function ListLoadingRow({
  label,
  colSpan,
}: Readonly<{ label: string; colSpan: number }>) {
  return (
    <tr>
      <td className="px-6 py-6 text-sm text-slate-500" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

export default function OrganizationPage() {
  const pathname = usePathname();
  const section = pathname.endsWith('/institutions')
    ? 'institutions'
    : pathname.endsWith('/departments')
      ? 'departments'
      : 'overview';
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);

  const [institutionModal, setInstitutionModal] =
    useState<InstitutionModalState | null>(null);
  const [institutionForm, setInstitutionForm] = useState<InstitutionFormState>(
    emptyInstitutionForm(),
  );
  const [institutionFormError, setInstitutionFormError] =
    useState<NormalizedApiError | null>(null);
  const [institutionSubmitting, setInstitutionSubmitting] = useState(false);

  const [departmentModal, setDepartmentModal] =
    useState<DepartmentModalState | null>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(
    emptyDepartmentForm(),
  );
  const [departmentFormError, setDepartmentFormError] =
    useState<NormalizedApiError | null>(null);
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const institutionCount = useMemo(() => institutions.length, [institutions]);
  const departmentCount = useMemo(() => departments.length, [departments]);

  const loadInstitutions = useCallback(async () => {
    setInstitutionsLoading(true);

    try {
      const response = await apiClient.get<unknown>('/institutions');
      setInstitutions(normalizeList(response.data, normalizeInstitution));
      setInstitutionsError(null);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setInstitutionsError(normalizedError.message);
    } finally {
      setInstitutionsLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    setDepartmentsLoading(true);

    try {
      const response = await apiClient.get<unknown>('/departments');
      setDepartments(normalizeList(response.data, normalizeDepartment));
      setDepartmentsError(null);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setDepartmentsError(normalizedError.message);
    } finally {
      setDepartmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapOrganizationData() {
      const [institutionsResult, departmentsResult] = await Promise.allSettled([
        apiClient.get<unknown>('/institutions'),
        apiClient.get<unknown>('/departments'),
      ]);

      if (!active) {
        return;
      }

      if (institutionsResult.status === 'fulfilled') {
        setInstitutions(
          normalizeList(institutionsResult.value.data, normalizeInstitution),
        );
        setInstitutionsError(null);
      } else {
        const normalizedError = institutionsResult.reason as NormalizedApiError;
        setInstitutionsError(normalizedError.message);
      }

      if (departmentsResult.status === 'fulfilled') {
        setDepartments(
          normalizeList(departmentsResult.value.data, normalizeDepartment),
        );
        setDepartmentsError(null);
      } else {
        const normalizedError = departmentsResult.reason as NormalizedApiError;
        setDepartmentsError(normalizedError.message);
      }

      setInstitutionsLoading(false);
      setDepartmentsLoading(false);
    }

    void bootstrapOrganizationData();

    return () => {
      active = false;
    };
  }, []);

  function openCreateInstitution() {
    setInstitutionModal({ mode: 'create', record: null });
    setInstitutionForm(emptyInstitutionForm());
    setInstitutionFormError(null);
  }

  function openEditInstitution(record: InstitutionRecord) {
    setInstitutionModal({ mode: 'edit', record });
    setInstitutionForm({
      name: record.name,
      rssbCode: record.rssbCode,
      address: record.address,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
    });
    setInstitutionFormError(null);
  }

  function closeInstitutionModal() {
    setInstitutionModal(null);
    setInstitutionForm(emptyInstitutionForm());
    setInstitutionFormError(null);
    setInstitutionSubmitting(false);
  }

  function openCreateDepartment() {
    setDepartmentModal({ mode: 'create', record: null });
    setDepartmentForm(
      emptyDepartmentForm(),
    );
    setDepartmentFormError(null);
  }

  function openEditDepartment(record: DepartmentRecord) {
    setDepartmentModal({ mode: 'edit', record });
    setDepartmentForm({
      name: record.name,
      institutionId: record.institutionId ?? '',
      description: record.description ?? '',
    });
    setDepartmentFormError(null);
  }

  function closeDepartmentModal() {
    setDepartmentModal(null);
    setDepartmentForm(emptyDepartmentForm());
    setDepartmentFormError(null);
    setDepartmentSubmitting(false);
  }

  function openDeleteModal(target: DeleteTarget) {
    setDeleteTarget(target);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteError(null);
    setDeleteSubmitting(false);
  }

  async function handleInstitutionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!institutionModal) {
      return;
    }

    setInstitutionSubmitting(true);
    setInstitutionFormError(null);

    const payload = {
      name: institutionForm.name.trim(),
      rssbCode: institutionForm.rssbCode.trim(),
      address: institutionForm.address.trim(),
      contactPhone: institutionForm.contactPhone.trim(),
      contactEmail: institutionForm.contactEmail.trim(),
    };

    try {
      if (institutionModal.mode === 'create') {
        await apiClient.post('/institutions', payload);
        toast.success('Institution added.');
      } else {
        await apiClient.patch(
          `/institutions/${institutionModal.record?.id}`,
          payload,
        );
        toast.success('Institution updated.');
      }

      closeInstitutionModal();
      await Promise.all([loadInstitutions(), loadDepartments()]);
    } catch (error) {
      setInstitutionFormError(error as NormalizedApiError);
    } finally {
      setInstitutionSubmitting(false);
    }
  }

  async function handleDepartmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!departmentModal) {
      return;
    }

    setDepartmentSubmitting(true);
    setDepartmentFormError(null);

    const payload = {
      name: departmentForm.name.trim(),
      institutionId: departmentForm.institutionId.trim(),
      description: departmentForm.description.trim() || null,
    };

    try {
      if (departmentModal.mode === 'create') {
        await apiClient.post('/departments', payload);
        toast.success('Department added.');
      } else {
        await apiClient.patch(
          `/departments/${departmentModal.record?.id}`,
          payload,
        );
        toast.success('Department updated.');
      }

      closeDepartmentModal();
      await loadDepartments();
    } catch (error) {
      setDepartmentFormError(error as NormalizedApiError);
    } finally {
      setDepartmentSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const path =
        deleteTarget.kind === 'institution'
          ? `/institutions/${deleteTarget.record.id}`
          : `/departments/${deleteTarget.record.id}`;

      await apiClient.delete(path);
      toast.success(
        deleteTarget.kind === 'institution'
          ? 'Institution deleted.'
          : 'Department deleted.',
      );

      closeDeleteModal();

      if (deleteTarget.kind === 'institution') {
        await Promise.all([loadInstitutions(), loadDepartments()]);
      } else {
        await loadDepartments();
      }
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setDeleteError(normalizedError.message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <RequireRole allowedRoles={['admin']}>
      <RouteShell
        eyebrow="Organization"
        title="Institution and department management"
        description="Manage institutions and departments."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-black/10 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Institutions
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {institutionsLoading ? '...' : institutionCount}
            </p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Departments
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {departmentsLoading ? '...' : departmentCount}
            </p>
          </div>
        </div>

        {section !== 'departments' ? (
        <SectionCard
          title="Institutions"
          description="Add, edit, and delete institutions."
          actionLabel="Create institution"
          onAction={openCreateInstitution}
        >
          {institutionsError ? (
            <div className="px-6 pt-6">
              <FormAlert tone="error">{institutionsError}</FormAlert>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/10 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">RSSB Code</th>
                  <th className="px-6 py-4 font-semibold">Address</th>
                  <th className="px-6 py-4 font-semibold">Contact Phone</th>
                  <th className="px-6 py-4 font-semibold">Contact Email</th>
                  <th className="px-6 py-4 font-semibold">Updated</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {institutionsLoading ? (
                  <ListLoadingRow label="Loading institutions..." colSpan={7} />
                ) : institutions.length === 0 ? (
                  <ListLoadingRow label="No institutions found." colSpan={7} />
                ) : (
                  institutions.map((institution) => (
                    <tr key={institution.id} className="align-top">
                      <td className="px-6 py-5 font-semibold text-slate-950">
                        {institution.name}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {institution.rssbCode || 'Unavailable'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {institution.address || 'Unavailable'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {institution.contactPhone || 'Unavailable'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {institution.contactEmail || 'Unavailable'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {formatDate(institution.updatedAt)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditInstitution(institution)}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openDeleteModal({ kind: 'institution', record: institution })
                            }
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
        ) : null}

        {section !== 'institutions' ? (
        <SectionCard
          title="Departments"
          description="Add, edit, and delete departments."
          actionLabel="Create department"
          onAction={openCreateDepartment}
          actionDisabled={institutionsLoading || institutions.length === 0}
        >
          {departmentsError ? (
            <div className="px-6 pt-6">
              <FormAlert tone="error">{departmentsError}</FormAlert>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/10 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Institution</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                  <th className="px-6 py-4 font-semibold">Updated</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {departmentsLoading ? (
                  <ListLoadingRow label="Loading departments..." colSpan={5} />
                ) : departments.length === 0 ? (
                  <ListLoadingRow label="No departments found." colSpan={5} />
                ) : (
                  departments.map((department) => (
                    <tr key={department.id} className="align-top">
                      <td className="px-6 py-5 font-semibold text-slate-950">
                        {department.name}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {department.institution?.name ??
                          department.institutionName ??
                          department.institutionId ??
                          'Unassigned'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {department.description || 'Unavailable'}
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {formatDate(department.updatedAt)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDepartment(department)}
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openDeleteModal({ kind: 'department', record: department })
                            }
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
        ) : null}
      </RouteShell>

      {institutionModal ? (
        <ModalShell
          title={
            institutionModal.mode === 'create'
              ? 'Create institution'
              : 'Edit institution'
          }
          description="Save the institution using name, RSSB code, address, contact phone, and contact email."
          onClose={closeInstitutionModal}
        >
          {institutionFormError && !institutionFormError.fieldErrors ? (
            <div className="mb-4">
              <FormAlert tone="error">{institutionFormError.message}</FormAlert>
            </div>
          ) : null}
          <form className="grid gap-5" onSubmit={handleInstitutionSubmit}>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Name
              <input
                type="text"
                value={institutionForm.name}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(institutionFormError, 'name')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              RSSB code
              <input
                type="text"
                value={institutionForm.rssbCode}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    rssbCode: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(institutionFormError, 'rssbCode')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Address
              <textarea
                value={institutionForm.address}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                className="mt-2 min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(institutionFormError, 'address')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Contact phone
              <input
                type="tel"
                value={institutionForm.contactPhone}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    contactPhone: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(institutionFormError, 'contactPhone')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Contact email
              <input
                type="email"
                value={institutionForm.contactEmail}
                onChange={(event) =>
                  setInstitutionForm((current) => ({
                    ...current,
                    contactEmail: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(institutionFormError, 'contactEmail')}
              />
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeInstitutionModal}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={institutionSubmitting}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {institutionSubmitting
                  ? 'Saving...'
                  : institutionModal.mode === 'create'
                    ? 'Create institution'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {departmentModal ? (
        <ModalShell
          title={
            departmentModal.mode === 'create'
              ? 'Create department'
              : 'Edit department'
          }
          description="Link the department to an institution so registration and profile data stay consistent."
          onClose={closeDepartmentModal}
          wide
        >
          {departmentFormError && !departmentFormError.fieldErrors ? (
            <div className="mb-4">
              <FormAlert tone="error">{departmentFormError.message}</FormAlert>
            </div>
          ) : null}
          <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleDepartmentSubmit}>
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Name
              <input
                type="text"
                value={departmentForm.name}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              />
              <FieldError
                message={fieldErrorMessage(departmentFormError, 'name')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Institution
              <select
                value={departmentForm.institutionId}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    institutionId: event.target.value,
                  }))
                }
                className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
                required
              >
                <option value="">Select an institution</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name} {institution.rssbCode ? `(${institution.rssbCode})` : ''}
                  </option>
                ))}
              </select>
              <FieldError
                message={fieldErrorMessage(departmentFormError, 'institutionId')}
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700 lg:col-span-2">
              Description
              <textarea
                value={departmentForm.description}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="mt-2 min-h-28 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950"
              />
              <FieldError
                message={fieldErrorMessage(departmentFormError, 'description')}
              />
            </label>

            <div className="lg:col-span-2 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeDepartmentModal}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={departmentSubmitting || institutions.length === 0}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {departmentSubmitting
                  ? 'Saving...'
                  : departmentModal.mode === 'create'
                    ? 'Create department'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          title={`Delete ${deleteTarget.kind}`}
          description="This action cannot be undone. Foreign-key conflicts are shown inline if the backend refuses the deletion."
          onClose={closeDeleteModal}
        >
          {deleteError ? (
            <div className="mb-4">
              <FormAlert tone="error">{deleteError}</FormAlert>
            </div>
          ) : null}
          <div className="rounded-3xl border border-black/10 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-slate-950">
              {deleteTarget.kind === 'institution'
                ? deleteTarget.record.name
                : deleteTarget.record.name}
            </p>
            <p className="mt-2">
              {deleteTarget.kind === 'institution'
                ? `RSSB code: ${deleteTarget.record.rssbCode || 'Unavailable'}`
                : `Institution: ${
                    deleteTarget.record.institution?.name ??
                    deleteTarget.record.institutionName ??
                    deleteTarget.record.institutionId ??
                    'Unassigned'
                  }`}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleteSubmitting}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              {deleteSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </RequireRole>
  );
}
