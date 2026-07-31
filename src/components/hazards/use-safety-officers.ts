'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/client';
import type { NormalizedApiError } from '@/lib/api/types';
import type { HazardUserOption } from '@/lib/hazards/types';

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

function normalizeSafetyOfficer(raw: unknown): HazardUserOption {
  const record = isRecord(raw) ? raw : {};

  return {
    id: readStringValue(record.id, ['id']),
    fullName:
      readStringValue(record.fullName, ['fullName', 'full_name', 'name']) ||
      asString(record.fullName),
    jobTitle:
      readStringValue(record.jobTitle, ['jobTitle', 'job_title', 'title']) ||
      asString(record.jobTitle),
    role:
      record.role === 'admin' ||
      record.role === 'manager' ||
      record.role === 'safety_officer' ||
      record.role === 'reporter'
        ? record.role
        : 'reporter',
  };
}

export function useSafetyOfficers(enabled = true) {
  const [officers, setOfficers] = useState<HazardUserOption[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    async function loadOfficers() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<unknown>(
          '/users?role=safety_officer',
        );

        if (!active) {
          return;
        }

        setOfficers(
          normalizeList(response.data, normalizeSafetyOfficer).filter(
            (officer) => officer.role === 'safety_officer',
          ),
        );
      } catch (error) {
        const normalizedError = error as NormalizedApiError;
        if (active) {
          setOfficers([]);
          setError(normalizedError.message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadOfficers();

    return () => {
      active = false;
    };
  }, [enabled]);

  const officersById = new Map(
    officers.map((officer) => [officer.id, officer] as const),
  );

  return { officers, officersById, isLoading, error };
}
