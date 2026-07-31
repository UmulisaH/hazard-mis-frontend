'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { RequireRole } from '@/components/auth/require-role';
import { FormAlert } from '@/components/auth/form-feedback';
import { RouteShell } from '@/components/layout/route-shell';
import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';

type ReferenceKind = 'categories' | 'severity-levels';
interface ReferenceRecord { id: string; name: string; description: string; weight?: number; }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function asString(value: unknown) { return typeof value === 'string' ? value : ''; }
function normalizeList(data: unknown): ReferenceRecord[] {
  const items = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.items) ? data.items : [];
  return items.map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      id: asString(record.id),
      name: asString(record.name),
      description: asString(record.description),
      weight: typeof record.weight === 'number' ? record.weight : undefined,
    };
  });
}

export default function ReferenceDataPage({ kind }: Readonly<{ kind: ReferenceKind }>) {
  const endpoint = kind === 'categories' ? '/hazard-categories' : '/severity-levels';
  const title = kind === 'categories' ? 'Hazard categories' : 'Severity levels';
  const [records, setRecords] = useState<ReferenceRecord[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<unknown>(endpoint);
      setRecords(normalizeList(response.data));
      setError(null);
    } catch (caught) {
      setError((caught as NormalizedApiError).message);
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const isEditing = useMemo(() => editingId !== null, [editingId]);
  function resetForm() { setEditingId(null); setName(''); setDescription(''); setWeight('1'); }

  async function submit() {
    setSubmitting(true); setError(null);
    const payload = kind === 'categories'
      ? { name: name.trim(), description: description.trim() || null }
      : { name: name.trim(), description: description.trim() || null, weight: Number(weight) };
    try {
      if (editingId) await apiClient.patch(`${endpoint}/${editingId}`, payload);
      else await apiClient.post(endpoint, payload);
      resetForm(); await load();
    } catch (caught) { setError((caught as NormalizedApiError).message); }
    finally { setSubmitting(false); }
  }

  async function remove(id: string) {
    setError(null);
    try { await apiClient.delete(`${endpoint}/${id}`); await load(); }
    catch (caught) { setError((caught as NormalizedApiError).message); }
  }

  return (
    <RequireRole allowedRoles={['admin']}>
      <RouteShell eyebrow="System configuration" title={title} description={`Manage ${title.toLowerCase()} used by hazard reports.`}>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="rounded-xl border border-slate-300 px-3 py-2" />
            {kind === 'severity-levels' ? <input type="number" value={weight} onChange={(event) => setWeight(event.target.value)} min="1" placeholder="Weight" className="rounded-xl border border-slate-300 px-3 py-2" /> : <span />}
            <div className="flex gap-2">
              <button type="button" disabled={submitting || !name.trim()} onClick={() => void submit()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{submitting ? 'Saving...' : isEditing ? 'Save' : 'Add'}</button>
              {isEditing ? <button type="button" onClick={resetForm} className="rounded-xl border px-4 py-2 text-sm">Cancel</button> : null}
            </div>
          </div>
        </section>
        <section className="overflow-hidden rounded-3xl border border-black/10 bg-white">
          <table className="min-w-full divide-y divide-black/10 text-left text-sm">
            <thead className="bg-slate-50"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Description</th>{kind === 'severity-levels' ? <th className="px-6 py-4">Weight</th> : null}<th className="px-6 py-4">Actions</th></tr></thead>
            <tbody className="divide-y divide-black/10">
              {loading ? <tr><td colSpan={kind === 'severity-levels' ? 4 : 3} className="px-6 py-8 text-slate-500">Loading...</td></tr> : records.map((record) => <tr key={record.id}><td className="px-6 py-4 font-semibold">{record.name}</td><td className="px-6 py-4">{record.description || 'Unavailable'}</td>{kind === 'severity-levels' ? <td className="px-6 py-4">{record.weight ?? 'Unavailable'}</td> : null}<td className="px-6 py-4"><button type="button" onClick={() => { setEditingId(record.id); setName(record.name); setDescription(record.description); setWeight(String(record.weight ?? 1)); }} className="mr-2 rounded-lg border px-3 py-1">Edit</button><button type="button" onClick={() => void remove(record.id)} className="rounded-lg border border-rose-200 px-3 py-1 text-rose-700">Delete</button></td></tr>)}
            </tbody>
          </table>
        </section>
      </RouteShell>
    </RequireRole>
  );
}
