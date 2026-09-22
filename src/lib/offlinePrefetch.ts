import { fetchByCompany } from './supabase';

const CORE_TABLES = [
  'vessels',
  'maintenance_tasks',
  'inventory_items',
  'equipment',
  'maintenance_history',
  'operational_expenses',
  'compliance_items',
  'crew_members',
  'fuel_resources',
  'fuel_log',
  'purchase_requests',
  'maintenance_manuals',
  'water_toys',
  'voyages',
  'voyage_guests',
  'vessel_budgets',
  'contractors',
  'stock_movements',
];

let prefetched = false;

export async function prefetchOfflineData(companyId: string): Promise<void> {
  if (prefetched || !navigator.onLine || !companyId) return;
  prefetched = true;

  const batch1 = CORE_TABLES.slice(0, 6);
  const batch2 = CORE_TABLES.slice(6, 12);
  const batch3 = CORE_TABLES.slice(12);

  try {
    await Promise.all(batch1.map(t => fetchByCompany(t, companyId).catch(() => [])));
    await Promise.all(batch2.map(t => fetchByCompany(t, companyId).catch(() => [])));
    await Promise.all(batch3.map(t => fetchByCompany(t, companyId).catch(() => [])));
  } catch { /* best-effort */ }
}

export function resetPrefetch(): void {
  prefetched = false;
}
