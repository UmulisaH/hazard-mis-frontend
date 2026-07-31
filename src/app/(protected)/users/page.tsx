'use client';

import { useCallback, useEffect, useState } from 'react';

import { RequireRole } from '@/components/auth/require-role';
import { FormAlert, FieldError } from '@/components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import type { AppRole, UpdateUserRoleRequest } from '@/lib/auth/types';
import { toast } from 'sonner';

interface EmployeeRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  role: AppRole;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, keys: string[] = []) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (isRecord(value)) {
    for (const key of keys) {
      if (typeof value[key] === 'string' || typeof value[key] === 'number') {
        return String(value[key]);
      }
    }
  }
  return '';
}

function normalizeList<T>(data: unknown, map: (item: unknown) => T) {
  if (Array.isArray(data)) return data.map(map);
  return isRecord(data) && Array.isArray(data.items) ? data.items.map(map) : [];
}

function normalizeEmployee(raw: unknown): EmployeeRow {
  const record = isRecord(raw) ? raw : {};
  const department = isRecord(record.department) ? record.department : {};
  const role = record.role;

  return {
    id: readString(record.id, ['id']),
    fullName: readString(record.fullName, ['fullName', 'full_name', 'name']),
    email: readString(record.email, ['email', 'contactEmail']),
    jobTitle: readString(record.jobTitle, ['jobTitle', 'job_title', 'title']),
    department:
      readString(record.department, ['name', 'departmentName']) ||
      readString(record.departmentName, [
        'departmentName',
        'department_name',
      ]) ||
      readString(department.name, ['name']),
    role:
      role === 'admin' ||
      role === 'manager' ||
      role === 'safety_officer' ||
      role === 'reporter'
        ? role
        : 'reporter',
  };
}

export default function UsersPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const fetchUsers = useCallback(async () => {
    const response = await apiClient.get<unknown>('/users');
    return normalizeList(response.data, normalizeEmployee);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchUsers()
      .then((users) => {
        if (active) setEmployees(users);
      })
      .catch((caught) => {
        if (active) setError((caught as NormalizedApiError).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchUsers]);

  async function updateRole(userId: string, role: AppRole) {
    setPending((current) => ({ ...current, [userId]: true }));
    setRowErrors((current) => ({ ...current, [userId]: '' }));
    const payload: UpdateUserRoleRequest = { role };

    try {
      await apiClient.patch(`/users/${userId}/roles`, payload);
      setEmployees((current) =>
        current.map((employee) =>
          employee.id === userId ? { ...employee, role } : employee,
        ),
      );
      toast.success('Role updated successfully.');
    } catch (caught) {
      const normalized = caught as NormalizedApiError;
      setRowErrors((current) => ({
        ...current,
        [userId]: normalized.fieldErrors?.role?.[0] ?? normalized.message,
      }));
    } finally {
      setPending((current) => ({ ...current, [userId]: false }));
    }
  }

  return (
    <RequireRole allowedRoles={['admin']}>
      <RouteShell
        eyebrow="Users"
        title="Employee management"
        description="Manage employee roles and access."
      >
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
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
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-sm text-slate-500"
                    >
                      Loading employees...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-sm text-slate-500"
                    >
                      No users were returned by the API.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id} className="align-top">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-950">
                          {employee.fullName}
                        </p>
                        <p className="text-slate-600">{employee.email}</p>
                        <p className="text-slate-500">{employee.jobTitle}</p>
                      </td>
                      <td className="px-6 py-5">
                        <select
                          value={employee.role}
                          disabled={Boolean(pending[employee.id])}
                          onChange={(event) =>
                            void updateRole(
                              employee.id,
                              event.target.value as AppRole,
                            )
                          }
                          aria-label={`Role for ${employee.fullName}`}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="safety_officer">Safety officer</option>
                          <option value="reporter">Reporter</option>
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {pending[employee.id] ? 'Updating...' : 'Ready'}
                        </p>
                        <FieldError message={rowErrors[employee.id]} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </RouteShell>
    </RequireRole>
  );
}
