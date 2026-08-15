import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchByCompany, dbInsert, dbUpdate, dbDelete } from './supabase';

// ── Query Keys ────────────────────────────────────────────────────────────────
// Centralized keys so invalidation works correctly across the app
export const queryKeys = {
  maintenance:  (companyId: string) => ['maintenance_tasks', companyId],
  inventory:    (companyId: string) => ['inventory_items', companyId],
  equipment:    (companyId: string) => ['equipment', companyId],
  vessels:      (companyId: string) => ['vessels', companyId],
  history:      (companyId: string) => ['maintenance_history', companyId],
  fuel:         (companyId: string) => ['fuel_resources', companyId],
  costs:        (companyId: string) => ['operational_expenses', companyId],
  manuals:      (companyId: string) => ['maintenance_manuals', companyId],
};

// ── Generic fetch hook ────────────────────────────────────────────────────────
export function useCompanyData(
  table: string,
  companyId: string | null | undefined,
  orderBy?: string,
  ascending = true,
  enabled = true,
) {
  return useQuery({
    queryKey: [table, companyId, orderBy, ascending],
    queryFn: () => fetchByCompany(table, companyId!, orderBy, ascending),
    enabled: !!companyId && enabled,
    placeholderData: (prev: any) => prev, // Show previous data while refreshing
  });
}

// ── Maintenance hooks ─────────────────────────────────────────────────────────
export function useMaintenanceTasks(companyId: string | null | undefined) {
  return useCompanyData('maintenance_tasks', companyId, 'next_due_date', true);
}

export function useInventoryItems(companyId: string | null | undefined) {
  return useCompanyData('inventory_items', companyId, 'created_at', false);
}

export function useEquipment(companyId: string | null | undefined) {
  return useCompanyData('equipment', companyId, 'created_at', false);
}

export function useVessels(companyId: string | null | undefined) {
  return useCompanyData('vessels', companyId, 'name', true);
}

export function useMaintenanceHistory(companyId: string | null | undefined) {
  return useCompanyData('maintenance_history', companyId, 'completion_date', false);
}

export function useFuelResources(companyId: string | null | undefined) {
  return useCompanyData('fuel_resources', companyId, 'name', true);
}

export function useOperationalExpenses(companyId: string | null | undefined) {
  return useCompanyData('operational_expenses', companyId, 'expense_date', false);
}

export function useManuals(companyId: string | null | undefined) {
  return useCompanyData('maintenance_manuals', companyId, 'created_at', false);
}

// ── Mutation hooks ────────────────────────────────────────────────────────────
// These automatically invalidate the cache after a successful mutation

interface MutationCallbacks {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

export function useInsert(table: string, companyId: string, callbacks?: MutationCallbacks) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => dbInsert(table, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [table, companyId] });
      callbacks?.onSuccess?.();
    },
    onError: (err: Error) => { callbacks?.onError?.(err); },
  });
}

export function useUpdate(table: string, companyId: string, callbacks?: MutationCallbacks) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      dbUpdate(table, id, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [table, companyId] });
      callbacks?.onSuccess?.();
    },
    onError: (err: Error) => { callbacks?.onError?.(err); },
  });
}

export function useDelete(table: string, companyId: string, callbacks?: MutationCallbacks) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dbDelete(table, id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [table, companyId] });
      callbacks?.onSuccess?.();
    },
    onError: (err: Error) => { callbacks?.onError?.(err); },
  });
}
