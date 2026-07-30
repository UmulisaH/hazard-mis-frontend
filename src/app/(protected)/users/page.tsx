'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RequireRole } from '@/components/auth/require-role';
import { FormAlert, FieldError } from '../../../components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import type { UpdateUserRoleRequest } from '@/lib/auth/types';
import { toast } from 'sonner';

interface EmployeeRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  isAdmin: boolean;
  isSafetyOfficer: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
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

function normalizeList<T>(data: unknown, mapItem: (item: unknown) => T): T[] {
  if (Array.isArray(data)) {
    return data.map(mapItem);
  }

  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items.map(mapItem);
  }

  return [];
}

function normalizeEmployee(raw: unknown): EmployeeRow {
  const record = isRecord(raw) ? raw : {};
  const department = isRecord(record.department) ? record.department : {};

  return {
    id: readStringValue(record.id, ['id']),
    fullName:
      readStringValue(record.fullName, ['fullName', 'full_name', 'name']) ||
      asString(record.fullName),
    email:
      readStringValue(record.email, ['email']) ||
      readStringValue(record.contactEmail, ['contactEmail', 'contact_email']),
    jobTitle:
      readStringValue(record.jobTitle, ['jobTitle', 'job_title', 'title']) ||
      asString(record.jobTitle),
    department:
      readStringValue(record.department, ['department', 'departmentName']) ||
      readStringValue(record.departmentName, ['departmentName', 'department_name']) ||
      readStringValue(department.name, ['name']),
    isAdmin: Boolean(record.isAdmin ?? record.is_admin),
    isSafetyOfficer: Boolean(record.isSafetyOfficer ?? record.is_safety_officer),
  };
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: Readonly<{
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        checked
          ? 'border-slate-950 bg-slate-950'
          : 'border-slate-300 bg-slate-200'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function UsersPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [pendingAdminIds, setPendingAdminIds] = useState<
    Record<string, boolean>
  >({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const employeeCount = useMemo(() => employees.length, [employees]);

  const fetchUsersFromApi = useCallback(async () => {
    const response = await apiClient.get<unknown>('/users');
    return normalizeList(response.data, normalizeEmployee);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapUsers() {
      setIsLoadingUsers(true);

      try {
        const userRows = await fetchUsersFromApi();

        if (!active) {
          return;
        }

        setEmployees(userRows);
      } catch (error) {
        const normalizedError = error as NormalizedApiError;
        if (active) {
          setBannerMessage(normalizedError.message);
          setEmployees([]);
        }
      } finally {
        if (active) {
          setIsLoadingUsers(false);
        }
      }
    }

    void bootstrapUsers();

    return () => {
      active = false;
    };
  }, [fetchUsersFromApi]);

  async function updateAdminRole(userId: string, nextIsAdmin: boolean) {
    setRowErrors((currentErrors) => ({ ...currentErrors, [userId]: '' }));
    setBannerMessage(null);
    setPendingAdminIds((currentPending) => ({
      ...currentPending,
      [userId]: true,
    }));

    const payload: UpdateUserRoleRequest = {
      isAdmin: nextIsAdmin,
    };

    try {
      await apiClient.patch(`/users/${userId}/roles`, payload);
      toast.success('Role updated successfully.');

      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === userId
            ? {
                ...employee,
                isAdmin: nextIsAdmin,
              }
            : employee,
        ),
      );
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      const rowMessage =
        normalizedError.fieldErrors?.isAdmin?.[0] ??
        normalizedError.message ??
        'Unable to update admin role.';

      setRowErrors((currentErrors) => ({
        ...currentErrors,
        [userId]: rowMessage,
      }));
      setBannerMessage(rowMessage);
    } finally {
      setPendingAdminIds((currentPending) => ({
        ...currentPending,
        [userId]: false,
      }));
    }
  }

  function updateSafetyOfficerRole(
    userId: string,
    nextIsSafetyOfficer: boolean,
  ) {
    console.warn(
      'Safety Officer role changes are not supported by the API yet; updating local UI state only.',
      {
        userId,
        nextIsSafetyOfficer,
      },
    );

    setEmployees((currentEmployees) =>
      currentEmployees.map((employee) =>
        employee.id === userId
          ? {
              ...employee,
              isSafetyOfficer: nextIsSafetyOfficer,
            }
          : employee,
      ),
    );
    toast.success('Safety officer status updated locally.');
  }

  return (
    <RequireRole allowedRoles={['Admin']}>
      <RouteShell
        eyebrow="Users"
        title="Employee management"
        description="Manage employee access."
      >
        {bannerMessage ? (
          <FormAlert tone="info">{bannerMessage}</FormAlert>
        ) : null}
        <div className="rounded-3xl border border-black/10 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-700">
          Employee count: {employeeCount}
        </div>

        {isLoadingUsers ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-600">
            Loading employees from the API...
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-600">
            No users were returned by the API.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Employee table
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/10 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Admin</th>
                  <th className="px-6 py-4 font-semibold">Safety Officer</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {employees.map((employee) => {
                  const isPending = Boolean(pendingAdminIds[employee.id]);
                  const rowError = rowErrors[employee.id];

                  return (
                    <tr key={employee.id} className="align-top">
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-950">
                            {employee.fullName}
                          </p>
                          <p className="text-slate-600">{employee.email}</p>
                          <p className="text-slate-500">{employee.jobTitle}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-700">
                        {employee.department}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <Switch
                            checked={employee.isAdmin}
                            onChange={(checked) =>
                              void updateAdminRole(employee.id, checked)
                            }
                            disabled={isPending}
                            label={`Toggle admin role for ${employee.fullName}`}
                          />
                          <p className="text-xs text-slate-500">
                            {employee.isAdmin
                              ? 'Admin enabled'
                              : 'Admin disabled'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <Switch
                            checked={employee.isSafetyOfficer}
                            onChange={(checked) =>
                              updateSafetyOfficerRole(employee.id, checked)
                            }
                            label={`Safety officer status for ${employee.fullName}`}
                          />
                          <p className="text-xs text-slate-500">
                            Local UI only until the backend exposes a safety
                            officer mutation.
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {isPending
                              ? 'Updating...'
                              : rowError
                                ? 'Update failed'
                                : 'Ready'}
                          </p>
                          <FieldError message={rowError} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </RouteShell>
    </RequireRole>
  );
}
