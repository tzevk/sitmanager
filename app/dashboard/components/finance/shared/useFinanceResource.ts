'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, jsonHeaders } from './api';
import { useToast } from './ToastProvider';

interface IdEntity { id: number }

interface State<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
}

interface ResourceApi<T extends IdEntity> {
  rows: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (body: Partial<T>, editing?: T | null) => Promise<void>;
  remove: (id: number) => Promise<boolean>;
}

/**
 * Generic CRUD against /api/finance/<resource> + /api/finance/<resource>/[id].
 * Replaces seven near-identical hand-rolled state machines.
 */
export function useFinanceResource<T extends IdEntity>(
  basePath: string,
  options: { listKey?: string; query?: string } = {},
): ResourceApi<T> {
  const listKey = options.listKey ?? 'rows';
  const url = options.query ? `${basePath}?${options.query}` : basePath;

  const [state, setState] = useState<State<T>>({ rows: [], loading: true, error: null });
  const toast = useToast();

  const refetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFetch<Record<string, T[]>>(url);
      setState({ rows: data[listKey] ?? [], loading: false, error: null });
    } catch (e) {
      setState({ rows: [], loading: false, error: e instanceof Error ? e.message : 'Error' });
    }
  }, [url, listKey]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (body: Partial<T>, editing?: T | null) => {
    try {
      if (editing) {
        await apiFetch(`${basePath}/${editing.id}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(basePath, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(body),
        });
      }
      await refetch();
      toast.success(editing ? 'Updated' : 'Added');
    } catch (e) {
      toast.error(e);
      throw e;
    }
  }, [basePath, refetch, toast]);

  const remove = useCallback(async (id: number) => {
    if (!confirm('Delete this entry?')) return false;
    try {
      await apiFetch(`${basePath}/${id}`, { method: 'DELETE' });
      await refetch();
      toast.success('Deleted');
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    }
  }, [basePath, refetch, toast]);

  return { rows: state.rows, loading: state.loading, error: state.error, refetch, save, remove };
}

/** Singleton-shaped resource (e.g. salary cashflow keyed by month). */
export function useFinanceSingleton<T>(basePath: string, query: string) {
  const [row, setRow] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const url = `${basePath}?${query}`;

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ row: T | null }>(url);
      setRow(d.row ?? null);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (body: Partial<T>) => {
    try {
      const d = await apiFetch<{ row: T }>(basePath, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });
      setRow(d.row);
      toast.success('Saved');
    } catch (e) {
      toast.error(e);
      throw e;
    }
  }, [basePath, toast]);

  return { row, loading, refetch, save };
}
