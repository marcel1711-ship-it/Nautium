import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Plus, Search, Filter, ChevronDown, Clock, CheckCircle2,
  XCircle, Package, Truck, AlertTriangle, Eye, X, Trash2, Send,
  FileText, Check, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { dbInsert, dbUpdate, dbDelete, fetchByCompany } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';
import { PurchaseRequest, PurchaseRequestItem, PRStatus, POStatus } from '../types';

interface ProcurementProps {
  onNavigate: (page: string, params?: any) => void;
}

interface VesselOption { id: string; name: string; }
interface InventoryOption { id: string; name: string; part_number?: string; unit_cost?: number; unit_of_measure?: string; supplier?: string; }

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const DEPARTMENTS = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety', 'General'] as const;
const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
] as const;

const EXPENSE_CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'provisions', label: 'Provisions' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'mooring', label: 'Mooring' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:                 { label: 'Draft',             color: 'bg-gray-100 text-gray-700',   icon: FileText },
  pending_captain:       { label: 'Pending Captain',   color: 'bg-amber-100 text-amber-700', icon: Clock },
  pending_fleet_manager: { label: 'Pending Fleet Mgr', color: 'bg-orange-100 text-orange-700', icon: Clock },
  approved:              { label: 'Approved',          color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:              { label: 'Rejected',          color: 'bg-red-100 text-red-700',     icon: XCircle },
  ordered:               { label: 'Ordered',           color: 'bg-blue-100 text-blue-700',   icon: Truck },
  partially_received:    { label: 'Partial',           color: 'bg-purple-100 text-purple-700', icon: Package },
  received:              { label: 'Received',          color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  closed:                { label: 'Closed',            color: 'bg-gray-100 text-gray-600',   icon: Check },
};

const generatePRNumber = () => {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `PR-${year}-${seq}`;
};

const generatePONumber = () => {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `PO-${year}-${seq}`;
};

export const Procurement: React.FC<ProcurementProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'requests' | 'orders'>('requests');
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPR, setViewingPR] = useState<PurchaseRequest | null>(null);
  const [rejectingPR, setRejectingPR] = useState<PurchaseRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => { loadData(); }, [currentUser, selectedVesselId]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    const cid = currentUser.company_id;
    if (!cid) { setLoading(false); return; }

    const [prData, vesselData, invData] = await Promise.all([
      fetchByCompany('purchase_requests', cid, 'created_at', false),
      fetchByCompany('vessels', cid, 'name', true),
      selectedVesselId && selectedVesselId !== 'all'
        ? supabase.from('inventory_items').select('id, name, part_number, unit_cost, unit_of_measure, supplier').eq('vessel_id', selectedVesselId).then(r => r.data || [])
        : fetchByCompany('inventory_items', cid, 'name', true),
    ]);

    setRequests(prData);
    setVessels(vesselData.map((v: any) => ({ id: v.id, name: v.name })));
    setInventoryItems(invData.map((i: any) => ({
      id: i.id, name: i.name, part_number: i.part_number,
      unit_cost: i.unit_cost, unit_of_measure: i.unit_of_measure,
      supplier: i.supplier,
    })));
    setLoading(false);
  };

  const getVesselName = (id: string) => vessels.find(v => v.id === id)?.name || 'Unknown';

  const canApprove = (pr: PurchaseRequest) => {
    if (!currentUser) return false;
    const role = currentUser.role;
    if (pr.status === 'pending_captain' && (role === 'captain' || role === 'customer_admin' || role === 'fleet_manager')) return true;
    if (pr.status === 'pending_fleet_manager' && (role === 'fleet_manager' || role === 'customer_admin')) return true;
    return false;
  };

  const handleApprove = async (pr: PurchaseRequest) => {
    if (!currentUser) return;

    const role = currentUser.role;
    let updates: any = {};

    if (pr.status === 'pending_captain') {
      const { data: vesselData } = await supabase
        .from('vessels')
        .select('approval_chain, has_management')
        .eq('id', pr.vessel_id)
        .single();

      const chain = vesselData?.approval_chain || 'captain_only';
      const needsFM = chain === 'captain_then_fleet_manager' && vesselData?.has_management;

      if (needsFM) {
        updates = {
          status: 'pending_fleet_manager',
          current_approver_role: 'fleet_manager',
          approved_by_captain_id: currentUser.id,
          approved_by_captain_name: currentUser.full_name,
          approved_by_captain_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        updates = {
          status: 'approved',
          current_approver_role: null,
          approved_by_captain_id: currentUser.id,
          approved_by_captain_name: currentUser.full_name,
          approved_by_captain_at: new Date().toISOString(),
          po_number: generatePONumber(),
          po_status: 'ordered',
          updated_at: new Date().toISOString(),
        };
      }
    } else if (pr.status === 'pending_fleet_manager') {
      updates = {
        status: 'approved',
        current_approver_role: null,
        approved_by_fm_id: currentUser.id,
        approved_by_fm_name: currentUser.full_name,
        approved_by_fm_at: new Date().toISOString(),
        po_number: generatePONumber(),
        po_status: 'ordered',
        updated_at: new Date().toISOString(),
      };
    }

    try {
      await dbUpdate('purchase_requests', pr.id, updates);

      await supabase.from('admin_notifications').insert({
        company_id: currentUser.company_id,
        type: updates.status === 'approved' ? 'pr_approved' : 'pr_pending',
        title: updates.status === 'approved' ? 'Purchase Request Approved' : 'PR awaiting Fleet Manager',
        message: `${pr.pr_number} — ${pr.currency} ${pr.total_estimated_cost} ${updates.status === 'approved' ? 'approved' : 'forwarded'} by ${currentUser.full_name}`,
        read: false,
      });

      showToast(updates.status === 'approved' ? 'Purchase request approved' : 'Forwarded to Fleet Manager', 'success');
      setViewingPR(null);
      loadData();
    } catch {
      showToast('Error approving request', 'error');
    }
  };

  const handleReject = async () => {
    if (!currentUser || !rejectingPR || !rejectNote.trim()) return;

    try {
      await dbUpdate('purchase_requests', rejectingPR.id, {
        status: 'rejected',
        current_approver_role: null,
        rejection_note: rejectNote,
        rejected_by_id: currentUser.id,
        rejected_by_name: currentUser.full_name,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await supabase.from('admin_notifications').insert({
        company_id: currentUser.company_id,
        type: 'pr_rejected',
        title: 'Purchase Request Rejected',
        message: `${rejectingPR.pr_number} rejected by ${currentUser.full_name}: ${rejectNote}`,
        read: false,
      });

      showToast('Purchase request rejected', 'success');
      setRejectingPR(null);
      setRejectNote('');
      setViewingPR(null);
      loadData();
    } catch {
      showToast('Error rejecting request', 'error');
    }
  };

  const handleMarkReceived = async (pr: PurchaseRequest) => {
    if (!currentUser) return;

    try {
      await dbUpdate('purchase_requests', pr.id, {
        po_status: 'received',
        received_at: new Date().toISOString(),
        received_by_id: currentUser.id,
        received_by_name: currentUser.full_name,
        updated_at: new Date().toISOString(),
      });

      // Load PR items to update inventory
      const { data: items } = await supabase
        .from('purchase_request_items')
        .select('*')
        .eq('purchase_request_id', pr.id);

      if (items) {
        for (const item of items) {
          if (item.inventory_item_id) {
            const { data: invItem } = await supabase
              .from('inventory_items')
              .select('current_stock')
              .eq('id', item.inventory_item_id)
              .single();

            if (invItem) {
              await supabase.from('inventory_items')
                .update({ current_stock: invItem.current_stock + item.quantity })
                .eq('id', item.inventory_item_id);

              await dbInsert('stock_movements', {
                inventory_id: item.inventory_item_id,
                vessel_id: pr.vessel_id,
                movement_type: 'in',
                quantity: item.quantity,
                reason: `PO ${pr.po_number} received`,
                performed_by_id: currentUser.id,
                performed_by_name: currentUser.full_name,
              });
            }
          }
        }
      }

      // Create expense record
      if (pr.total_estimated_cost > 0) {
        await dbInsert('operational_expenses', {
          vessel_id: pr.vessel_id,
          company_id: currentUser.company_id,
          category: pr.expense_category || 'maintenance',
          description: `PO ${pr.po_number} — ${pr.vendor_name || 'Vendor'}`,
          amount: pr.total_estimated_cost,
          currency: pr.currency,
          expense_date: new Date().toISOString().split('T')[0],
          department: pr.department,
          created_by: currentUser.id,
          status: 'approved',
          requested_by: pr.requested_by_id,
          requested_by_name: pr.requested_by_name,
          approved_by: currentUser.id,
          approved_by_name: currentUser.full_name,
          approved_at: new Date().toISOString(),
        });
      }

      showToast('Order received — inventory and costs updated', 'success');
      setViewingPR(null);
      loadData();
    } catch {
      showToast('Error marking as received', 'error');
    }
  };

  const handleDelete = async (pr: PurchaseRequest) => {
    try {
      await dbDelete('purchase_requests', pr.id);
      showToast('Request deleted', 'success');
      setViewingPR(null);
      loadData();
    } catch {
      showToast('Error deleting request', 'error');
    }
  };

  // ── Filtered lists ────────────────────────────────────────────────────────

  const isOrder = (pr: PurchaseRequest) => pr.status === 'approved' && pr.po_number;
  const prList = requests.filter(r => !isOrder(r));
  const poList = requests.filter(r => isOrder(r));

  const filterList = (list: PurchaseRequest[]) => {
    let filtered = list;
    if (selectedVesselId && selectedVesselId !== 'all') {
      filtered = filtered.filter(r => r.vessel_id === selectedVesselId);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => {
        if (tab === 'orders') return r.po_status === filterStatus;
        return r.status === filterStatus;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.pr_number.toLowerCase().includes(term) ||
        r.po_number?.toLowerCase().includes(term) ||
        r.vendor_name?.toLowerCase().includes(term) ||
        r.justification?.toLowerCase().includes(term) ||
        r.requested_by_name?.toLowerCase().includes(term)
      );
    }
    return filtered;
  };

  const displayList = filterList(tab === 'requests' ? prList : poList);
  const pendingCount = requests.filter(r => r.status === 'pending_captain' || r.status === 'pending_fleet_manager').length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-blue-600" />
            Procurement
          </h1>
          <p className="text-gray-500 mt-1">Purchase requests and orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" /> New Request
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => { setTab('requests'); setFilterStatus('all'); }}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${tab === 'requests' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Purchase Requests
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('orders'); setFilterStatus('all'); }}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${tab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Purchase Orders
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by PR#, vendor, description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {tab === 'requests' ? (
              <>
                <option value="draft">Draft</option>
                <option value="pending_captain">Pending Captain</option>
                <option value="pending_fleet_manager">Pending Fleet Mgr</option>
                <option value="rejected">Rejected</option>
              </>
            ) : (
              <>
                <option value="ordered">Ordered</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Received</option>
                <option value="closed">Closed</option>
              </>
            )}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      {displayList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {tab === 'requests' ? 'No purchase requests yet' : 'No purchase orders yet'}
          </p>
          {tab === 'requests' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 font-medium hover:text-blue-700"
            >
              Create your first request
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map(pr => {
            const statusKey = tab === 'orders' ? (pr.po_status || 'ordered') : pr.status;
            const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
            const StatusIcon = config.icon;
            const urgencyConfig = URGENCY_OPTIONS.find(u => u.value === pr.urgency);

            return (
              <div
                key={pr.id}
                onClick={() => setViewingPR(pr)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{tab === 'orders' ? pr.po_number : pr.pr_number}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        <StatusIcon className="w-3 h-3" /> {config.label}
                      </span>
                      {urgencyConfig && pr.urgency !== 'medium' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${urgencyConfig.color}`}>
                          {urgencyConfig.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {pr.vendor_name && <span className="font-medium">{pr.vendor_name} · </span>}
                      {pr.justification || pr.department}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{getVesselName(pr.vessel_id)}</span>
                      <span>·</span>
                      <span>{pr.department}</span>
                      <span>·</span>
                      <span>{pr.requested_by_name}</span>
                      <span>·</span>
                      <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{pr.currency} {pr.total_estimated_cost.toLocaleString()}</p>
                    {canApprove(pr) && (
                      <span className="text-xs text-amber-600 font-medium">Action needed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create PR Modal ────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreatePRModal
          vessels={vessels}
          inventoryItems={inventoryItems}
          companyId={currentUser?.company_id || ''}
          defaultVesselId={selectedVesselId !== 'all' ? selectedVesselId : ''}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); loadData(); }}
        />
      )}

      {/* ── View/Action PR Modal ───────────────────────────────────────────── */}
      {viewingPR && (
        <PRDetailModal
          pr={viewingPR}
          vesselName={getVesselName(viewingPR.vessel_id)}
          canApprove={canApprove(viewingPR)}
          canDelete={viewingPR.status === 'draft' || viewingPR.status === 'rejected'}
          canReceive={viewingPR.po_status === 'ordered' || viewingPR.po_status === 'partially_received'}
          onClose={() => setViewingPR(null)}
          onApprove={() => handleApprove(viewingPR)}
          onReject={() => { setRejectingPR(viewingPR); }}
          onReceive={() => handleMarkReceived(viewingPR)}
          onDelete={() => handleDelete(viewingPR)}
        />
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {rejectingPR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject {rejectingPR.pr_number}</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejection.</p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Reason for rejection..."
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectingPR(null); setRejectNote(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectNote.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Create PR Modal ─────────────────────────────────────────────────────────

interface CreatePRModalProps {
  vessels: VesselOption[];
  inventoryItems: InventoryOption[];
  companyId: string;
  defaultVesselId?: string;
  onClose: () => void;
  onSaved: () => void;
  prefill?: { category?: string; amount?: string; description?: string; vesselId?: string; department?: string };
}

interface LineItem {
  key: number;
  name: string;
  part_number: string;
  quantity: number;
  unit_cost: number;
  unit_of_measure: string;
  inventory_item_id: string;
  notes: string;
}

const CreatePRModal: React.FC<CreatePRModalProps> = ({
  vessels, inventoryItems, companyId, defaultVesselId, onClose, onSaved, prefill,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  let lineKeyRef = React.useRef(1);

  const [form, setForm] = useState({
    vessel_id: prefill?.vesselId || defaultVesselId || (vessels.length === 1 ? vessels[0].id : ''),
    department: prefill?.department || 'Engineering',
    urgency: 'medium',
    vendor_name: '',
    vendor_email: '',
    vendor_phone: '',
    justification: prefill?.description || '',
    expense_category: prefill?.category || 'maintenance',
    currency: 'EUR',
  });

  const [items, setItems] = useState<LineItem[]>([{
    key: 0, name: '', part_number: '', quantity: 1,
    unit_cost: prefill?.amount ? parseFloat(prefill.amount) : 0,
    unit_of_measure: 'unit', inventory_item_id: '', notes: '',
  }]);

  const totalCost = items.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0);

  const addItem = () => {
    setItems(prev => [...prev, {
      key: lineKeyRef.current++, name: '', part_number: '', quantity: 1,
      unit_cost: 0, unit_of_measure: 'unit', inventory_item_id: '', notes: '',
    }]);
  };

  const removeItem = (key: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.key !== key));
  };

  const updateItem = (key: number, field: string, value: any) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const linkInventory = (key: number, invId: string) => {
    const inv = inventoryItems.find(i => i.id === invId);
    if (!inv) return;
    setItems(prev => prev.map(i => i.key === key ? {
      ...i,
      inventory_item_id: invId,
      name: inv.name,
      part_number: inv.part_number || '',
      unit_cost: inv.unit_cost || 0,
      unit_of_measure: inv.unit_of_measure || 'unit',
    } : i));
    if (inv.supplier && !form.vendor_name) {
      setForm(prev => ({ ...prev, vendor_name: inv.supplier! }));
    }
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!currentUser || !form.vessel_id) return;
    if (items.every(i => !i.name.trim())) {
      showToast('Add at least one item', 'warning');
      return;
    }

    setSaving(true);

    try {
      // Determine initial status and approver
      let status: PRStatus = 'draft';
      let currentApproverRole: string | null = null;

      if (!asDraft) {
        const role = currentUser.role;
        if (role === 'captain' || role === 'customer_admin' || role === 'fleet_manager') {
          // These roles can self-submit; goes to next level or auto-approve
          const { data: vesselData } = await supabase
            .from('vessels')
            .select('approval_chain, has_management')
            .eq('id', form.vessel_id)
            .single();

          const chain = vesselData?.approval_chain || 'captain_only';

          if (role === 'fleet_manager' || role === 'customer_admin') {
            status = 'approved';
          } else if (role === 'captain') {
            if (chain === 'captain_then_fleet_manager' && vesselData?.has_management) {
              status = 'pending_fleet_manager';
              currentApproverRole = 'fleet_manager';
            } else {
              status = 'approved';
            }
          }
        } else {
          status = 'pending_captain';
          currentApproverRole = 'captain';
        }
      }

      const prNumber = generatePRNumber();
      const prData: any = {
        pr_number: prNumber,
        company_id: companyId,
        vessel_id: form.vessel_id,
        department: form.department,
        urgency: form.urgency,
        status,
        total_estimated_cost: totalCost,
        currency: form.currency,
        vendor_name: form.vendor_name || null,
        vendor_email: form.vendor_email || null,
        vendor_phone: form.vendor_phone || null,
        justification: form.justification || null,
        expense_category: form.expense_category,
        requested_by_id: currentUser.id,
        requested_by_name: currentUser.full_name,
        requested_by_role: currentUser.role,
        current_approver_role: currentApproverRole,
      };

      if (status === 'approved') {
        prData.po_number = generatePONumber();
        prData.po_status = 'ordered';
        prData.approved_by_captain_id = currentUser.id;
        prData.approved_by_captain_name = currentUser.full_name;
        prData.approved_by_captain_at = new Date().toISOString();
      }

      const inserted = await dbInsert('purchase_requests', prData);

      // Insert line items
      const validItems = items.filter(i => i.name.trim());
      for (const item of validItems) {
        await dbInsert('purchase_request_items', {
          purchase_request_id: inserted.id,
          name: item.name,
          part_number: item.part_number || null,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          unit_of_measure: item.unit_of_measure,
          inventory_item_id: item.inventory_item_id || null,
          notes: item.notes || null,
        });
      }

      // Notification if pending
      if (status.startsWith('pending_')) {
        await supabase.from('admin_notifications').insert({
          company_id: companyId,
          type: 'pr_pending',
          title: 'New Purchase Request',
          message: `${prNumber} — ${form.currency} ${totalCost} from ${currentUser.full_name} (${form.department})`,
          read: false,
        });
      }

      showToast(
        asDraft ? 'Draft saved' :
        status === 'approved' ? 'Request approved — PO created' :
        'Request submitted for approval',
        'success'
      );
      onSaved();
    } catch {
      showToast('Error creating request', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">New Purchase Request</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vessel *</label>
              <select
                value={form.vessel_id}
                onChange={e => setForm(p => ({ ...p, vessel_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select vessel</option>
                {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={form.department}
                onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <select
                value={form.urgency}
                onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                {URGENCY_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expense Category</label>
              <select
                value={form.expense_category}
                onChange={e => setForm(p => ({ ...p, expense_category: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Vendor name"
                value={form.vendor_name}
                onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.vendor_email}
                onChange={e => setForm(p => ({ ...p, vendor_email: e.target.value }))}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Phone"
                value={form.vendor_phone}
                onChange={e => setForm(p => ({ ...p, vendor_phone: e.target.value }))}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
            <textarea
              rows={2}
              value={form.justification}
              onChange={e => setForm(p => ({ ...p, justification: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              placeholder="Why is this purchase needed?"
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Items *</label>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.key} className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.key)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Link to inventory */}
                  {inventoryItems.length > 0 && (
                    <select
                      value={item.inventory_item_id}
                      onChange={e => e.target.value ? linkInventory(item.key, e.target.value) : null}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Link to inventory item (optional)</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}{inv.part_number ? ` (${inv.part_number})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Item name *"
                        value={item.name}
                        onChange={e => updateItem(item.key, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Part #"
                      value={item.part_number}
                      onChange={e => updateItem(item.key, 'part_number', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={item.unit_of_measure}
                      onChange={e => updateItem(item.key, 'unit_of_measure', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.key, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Unit Cost ({form.currency})</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_cost}
                        onChange={e => updateItem(item.key, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-gray-700">
                    Subtotal: {form.currency} {(item.quantity * item.unit_cost).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl flex items-center justify-between">
              <span className="font-medium text-blue-900">Estimated Total</span>
              <span className="text-xl font-bold text-blue-900">{form.currency} {totalCost.toLocaleString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={saving || !form.vessel_id}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── PR Detail Modal ─────────────────────────────────────────────────────────

const PRDetailModal: React.FC<{
  pr: PurchaseRequest;
  vesselName: string;
  canApprove: boolean;
  canDelete: boolean;
  canReceive: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReceive: () => void;
  onDelete: () => void;
}> = ({ pr, vesselName, canApprove, canDelete, canReceive, onClose, onApprove, onReject, onReceive, onDelete }) => {
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      const { data } = await supabase
        .from('purchase_request_items')
        .select('*')
        .eq('purchase_request_id', pr.id);
      setItems(data || []);
      setLoading(false);
    };
    loadItems();
  }, [pr.id]);

  const statusKey = pr.po_number ? (pr.po_status || 'ordered') : pr.status;
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
  const StatusIcon = config.icon;
  const urgencyConfig = URGENCY_OPTIONS.find(u => u.value === pr.urgency);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {pr.po_number || pr.pr_number}
              </h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <StatusIcon className="w-3.5 h-3.5" /> {config.label}
              </span>
            </div>
            {pr.po_number && pr.pr_number && (
              <p className="text-xs text-gray-400 mt-0.5">From {pr.pr_number}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Vessel</span>
              <p className="font-medium text-gray-900">{vesselName}</p>
            </div>
            <div>
              <span className="text-gray-500">Department</span>
              <p className="font-medium text-gray-900">{pr.department}</p>
            </div>
            <div>
              <span className="text-gray-500">Requested by</span>
              <p className="font-medium text-gray-900">{pr.requested_by_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Urgency</span>
              <p className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${urgencyConfig?.color || ''}`}>
                {urgencyConfig?.label || pr.urgency}
              </p>
            </div>
            {pr.vendor_name && (
              <div className="col-span-2">
                <span className="text-gray-500">Vendor</span>
                <p className="font-medium text-gray-900">
                  {pr.vendor_name}
                  {pr.vendor_email && <span className="text-gray-500 ml-2">{pr.vendor_email}</span>}
                </p>
              </div>
            )}
            {pr.justification && (
              <div className="col-span-2">
                <span className="text-gray-500">Justification</span>
                <p className="font-medium text-gray-900">{pr.justification}</p>
              </div>
            )}
          </div>

          {/* Approval trail */}
          {(pr.approved_by_captain_name || pr.approved_by_fm_name || pr.rejected_by_name) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Approval Trail</span>
              {pr.approved_by_captain_name && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">Captain: <strong>{pr.approved_by_captain_name}</strong></span>
                  <span className="text-gray-400 text-xs">{pr.approved_by_captain_at ? new Date(pr.approved_by_captain_at).toLocaleString() : ''}</span>
                </div>
              )}
              {pr.approved_by_fm_name && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">Fleet Manager: <strong>{pr.approved_by_fm_name}</strong></span>
                  <span className="text-gray-400 text-xs">{pr.approved_by_fm_at ? new Date(pr.approved_by_fm_at).toLocaleString() : ''}</span>
                </div>
              )}
              {pr.rejected_by_name && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-gray-700">Rejected by: <strong>{pr.rejected_by_name}</strong></span>
                  {pr.rejection_note && <span className="text-gray-500 italic">"{pr.rejection_note}"</span>}
                </div>
              )}
            </div>
          )}

          {/* Items table */}
          <div>
            <span className="text-sm font-medium text-gray-700">Items</span>
            {loading ? (
              <div className="py-8 text-center text-gray-400">Loading items...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No items</div>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Part #</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 pr-3 text-right">Unit Cost</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2.5 pr-3 font-medium text-gray-900">{item.name}</td>
                        <td className="py-2.5 pr-3 text-gray-500">{item.part_number || '—'}</td>
                        <td className="py-2.5 pr-3 text-right">{item.quantity} {item.unit_of_measure}</td>
                        <td className="py-2.5 pr-3 text-right">{pr.currency} {item.unit_cost}</td>
                        <td className="py-2.5 text-right font-medium">{pr.currency} {(item.quantity * item.unit_cost).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={4} className="py-3 text-right font-bold text-gray-900">Total</td>
                      <td className="py-3 text-right font-bold text-blue-700">{pr.currency} {pr.total_estimated_cost.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {canDelete && (
              confirmDelete ? (
                <button
                  onClick={onDelete}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Confirm Delete
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2.5 border border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}

            <div className="flex-1" />

            {canReceive && (
              <button
                onClick={onReceive}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 flex items-center gap-2"
              >
                <Package className="w-4 h-4" /> Mark Received
              </button>
            )}

            {canApprove && (
              <>
                <button
                  onClick={onReject}
                  className="px-5 py-2.5 border border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50"
                >
                  Reject
                </button>
                <button
                  onClick={onApprove}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
