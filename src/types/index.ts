export interface Company {
  id: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  subscription_status: 'active' | 'trial' | 'expired' | 'cancelled';
  subscription_renewal_date?: string;
  customer_type?: 'fleet_operator' | 'yacht_owner' | 'charter' | 'other';
  yacht_name?: string;
  vessel_limit?: number;
  email_notifications?: boolean;
  notes?: string;
  created_at: string;
}

export interface Vessel {
  id: string;
  company_id: string;
  name: string;
  type?: string;
  flag?: string;
  year_built?: number;
  length_overall?: number;
  gross_tonnage?: number;
  registration_id?: string;
  description?: string;
  location?: string;
  notes?: string;
  photo_url?: string;
  notification_email?: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role:
    | 'master_admin'
    | 'customer_admin'
    | 'standard_user'
    | 'owner'
    | 'fleet_manager'
    | 'captain'
    | 'chief_engineer'
    | 'engineer'
    | 'chief_stew'
    | 'deck_officer'
    | 'chef'
    | 'safety_officer'
    | 'crew';
  status: 'active' | 'inactive';
  vessel_ids: string[];
  department?: string | null;
  created_at: string;
}

export interface Equipment {
  id: string;
  vessel_id: string;
  company_id?: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  description?: string;
  location?: string;
  installation_date?: string;
  photo_url?: string;
  water_toy_id?: string;
  equipment_hours?: number;
  created_at: string;
}

export type WaterToyType = 'Tender' | 'Jet Ski' | 'SeaBob' | 'Kayak' | 'Paddleboard' | 'Wakeboard' | 'Inflatable' | 'Other';
export type WaterToyStatus = 'active' | 'in_service' | 'retired';

export interface WaterToy {
  id: string;
  vessel_id: string;
  company_id?: string;
  name: string;
  type: WaterToyType;
  manufacturer?: string;
  model?: string;
  year?: number;
  engine_type?: string;
  engine_power?: string;
  capacity?: number;
  serial_number?: string;
  value?: number;
  insurance_info?: string;
  photo_url?: string;
  notes?: string;
  status: WaterToyStatus;
  created_at: string;
  water_toy_id?: string;
}

export interface MaintenanceTask {
  id: string;
  vessel_id: string;
  company_id: string;
  equipment_id?: string;
  water_toy_id?: string;
  title: string;
  description?: string;
  category?: string;
  department?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom' | 'one_time';
  custom_interval_days?: number;
  last_completed_date?: string;
  next_due_date?: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  assigned_to?: string;
  estimated_hours?: number;
  notes?: string;
  photo_urls?: string[];
  created_at?: string;
}

export interface MaintenanceHistory {
  id: string;
  task_id?: string;
  vessel_id: string;
  company_id: string;
  task_title: string;
  equipment_name?: string;
  completion_date: string;
  completed_by_id?: string;
  completed_by_name: string;
  parts_used?: string;
  notes?: string;
  next_due_date?: string;
  external_service_cost?: number;
  photo_urls?: string[];
  created_at?: string;
}

export interface InventoryItem {
  id: string;
  vessel_id: string;
  company_id: string;
  name: string;
  part_number?: string;
  category: string;
  type?: string;
  location?: string;
  storage_location?: string;
  department?: string;
  current_stock: number;
  minimum_stock: number;
  unit_of_measure: string;
  unit_cost?: number;
  supplier?: string;
  supplier_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  serial_number?: string;
  description?: string;
  notes?: string;
  photo_url?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  inventory_id: string;
  vessel_id: string;
  company_id?: string;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason?: string;
  notes?: string;
  reference_id?: string | null;
  performed_by_id?: string;
  performed_by_name: string;
  created_at: string;
}

export interface MaintenanceManual {
  id: string;
  vessel_id: string;
  company_id: string;
  equipment_id?: string;
  category?: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

export type ResourceType =
  | 'diesel_main'
  | 'diesel_generator'
  | 'gasoline_main'
  | 'gasoline_generator'
  | 'fresh_water'
  | 'engine_oil'
  | 'hydraulic_oil'
  | 'grey_water'
  | 'black_water'
  | 'other';

export interface FuelResource {
  id: string;
  vessel_id: string;
  company_id: string;
  name: string;
  resource_type: ResourceType;
  unit: string;
  capacity: number;
  current_level: number;
  low_level_alert: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FuelLogEntry {
  id: string;
  resource_id: string;
  vessel_id: string;
  company_id: string;
  entry_type: 'refill' | 'consumption';
  quantity: number;
  price_per_unit?: number | null;
  total_cost?: number | null;
  currency: string;
  supplier?: string;
  location?: string;
  engine_hours?: number | null;
  notes?: string;
  log_date: string;
  logged_by_id?: string;
  logged_by_name: string;
  created_at: string;
}

export type OperationalExpenseCategory =
  | 'mooring'
  | 'electricity'
  | 'water'
  | 'internet'
  | 'waste_disposal'
  | 'port_fees'
  | 'insurance'
  | 'fuel'
  | 'maintenance'
  | 'provisions'
  | 'crew_expenses'
  | 'repairs'
  | 'communications'
  | 'entertainment'
  | 'transport'
  | 'crew_salary'
  | 'Day Worker'
  | 'other';

export type OperationalExpenseDepartment =
  | 'Engineering'
  | 'Deck'
  | 'Interior'
  | 'Galley'
  | 'Safety'
  | 'General';

export interface OperationalExpense {
  id: string;
  vessel_id: string;
  company_id: string;
  category: OperationalExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  vendor?: string;
  notes?: string;
  created_by?: string;
  /** Department that owns this expense */
  department?: OperationalExpenseDepartment | null;
  created_at: string;
}

export interface CrewMember {
  id: string;
  vessel_id: string;
  company_id: string;
  full_name: string;
  position: string;
  department: string;
  nationality?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  embark_date?: string;
  disembark_date?: string;
  contract_end_date?: string;
  monthly_salary: number;
  salary_currency: string;
  photo_url?: string;
  notes?: string;
  status: 'active' | 'on_leave' | 'off_vessel';
  created_at: string;
  updated_at: string;
}

// ── Purchase Requests / Purchase Orders ──────────────────────────────────────

export type PRStatus = 'draft' | 'pending_captain' | 'pending_fleet_manager' | 'approved' | 'rejected';
export type POStatus = 'ordered' | 'partially_received' | 'received' | 'closed';

export interface PurchaseRequest {
  id: string;
  pr_number: string;
  company_id: string;
  vessel_id: string;
  department: OperationalExpenseDepartment;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: PRStatus;
  total_estimated_cost: number;
  currency: string;
  vendor_name?: string;
  vendor_email?: string;
  vendor_phone?: string;
  justification?: string;
  requested_by_id?: string;
  requested_by_name?: string;
  requested_by_role?: string;
  current_approver_role?: string;
  approved_by_captain_id?: string;
  approved_by_captain_name?: string;
  approved_by_captain_at?: string;
  approved_by_fm_id?: string;
  approved_by_fm_name?: string;
  approved_by_fm_at?: string;
  rejection_note?: string;
  rejected_by_id?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  po_number?: string;
  po_status?: POStatus;
  ordered_at?: string;
  received_at?: string;
  received_by_id?: string;
  received_by_name?: string;
  expense_category?: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseRequestItem[];
}

export interface PurchaseRequestItem {
  id: string;
  purchase_request_id: string;
  name: string;
  part_number?: string;
  quantity: number;
  unit_cost: number;
  unit_of_measure: string;
  inventory_item_id?: string;
  notes?: string;
  received_quantity: number;
  created_at: string;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export type UserRole = User['role'];

export const FULL_ACCESS_ROLES: UserRole[] = [
  'master_admin',
  'customer_admin',
  'fleet_manager',
  'captain',
];

export const ROLE_DEPARTMENT_MAP: Partial<Record<UserRole, string>> = {
  chief_engineer: 'Engineering',
  engineer:       'Engineering',
  chief_stew:     'Interior',
  deck_officer:   'Deck',
  chef:           'Galley',
  safety_officer: 'Safety',
};

export const getRoleDepartment = (role: UserRole): string | null =>
  ROLE_DEPARTMENT_MAP[role] ?? null;

export const hasFullAccess = (role: UserRole): boolean =>
  FULL_ACCESS_ROLES.includes(role);

export const canCreate = (role: UserRole): boolean =>
  !(['crew' as UserRole, 'engineer' as UserRole].includes(role)) ||
  FULL_ACCESS_ROLES.includes(role);
