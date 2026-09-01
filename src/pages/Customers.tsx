import React, { useState, useEffect } from 'react';
import {
  Building2, Search, Plus, AlertCircle, Mail, Phone,
  Pencil, Trash2, Ruler, Weight, CreditCard, Clock, Users as UsersIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { formatDate } from '../utils/helpers';
import { AddCustomerModal } from '../components/Customers/AddCustomerModal';
import { EditCustomerModal } from '../components/Customers/EditCustomerModal';
import { useToast } from '../components/UI/Toast';

interface Company {
  id: string;
  name: string;
  customer_type: 'yacht_owner' | 'agency';
  yacht_name: string;
  vessel_limit: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  subscription_status: 'active' | 'trial' | 'inactive';
  subscription_renewal_date: string;
  notes: string;
  created_at: string;
  vessels?: { id: string; gross_tonnage: number | null; length_overall: number | null; photo_url: string | null }[];
}

interface CustomersProps {
  onNavigate: (page: string, params?: any) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active:   { bg: '#dcfce7', text: '#15803d', dot: '#16a34a' },
  trial:    { bg: '#fef9c3', text: '#854d0e', dot: '#d97706' },
  inactive: { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
};

export const Customers: React.FC<CustomersProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Company | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'master_admin') fetchCompanies();
  }, [currentUser]);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*, vessels(id, gross_tonnage, length_overall, photo_url)')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setCompanies(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? This will also delete all associated users and data. This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-company`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'Apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ company_id: id }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete customer');
      setCompanies(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      showToast('Failed to delete customer: ' + err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditCustomer = (customer: Company) => {
    setEditingCustomer(customer);
    setIsEditModalOpen(true);
  };

  if (currentUser?.role !== 'master_admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">{t('users.accessDenied')}</p>
          <p className="text-gray-600">{t('users.adminOnly')}</p>
        </div>
      </div>
    );
  }

  const customers = companies.filter(c => {
    const matchStatus = filterStatus === 'all' || c.subscription_status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      c.name.toLowerCase().includes(term) ||
      c.contact_name.toLowerCase().includes(term) ||
      c.contact_email.toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });

  const activeCount   = companies.filter(c => c.subscription_status === 'active').length;
  const trialCount    = companies.filter(c => c.subscription_status === 'trial').length;
  const inactiveCount = companies.filter(c => c.subscription_status === 'inactive').length;

  const kpis = [
    { label: t('customers.totalCustomers'),     value: companies.length, icon: Building2,  iconColor: '#38bdf8', iconBg: 'rgba(56,189,248,0.12)',  accent: false },
    { label: t('customers.activeSubscriptions'), value: activeCount,      icon: CreditCard, iconColor: '#34d399', iconBg: 'rgba(52,211,153,0.12)',  accent: false },
    { label: t('customers.trialAccounts'),       value: trialCount,       icon: Clock,      iconColor: '#fbbf24', iconBg: 'rgba(251,191,36,0.12)',  accent: false },
    { label: t('customers.inactiveAccounts'),    value: inactiveCount,    icon: UsersIcon,  iconColor: inactiveCount > 0 ? '#f87171' : '#9ca3af', iconBg: inactiveCount > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(156,163,175,0.1)', accent: inactiveCount > 0 },
  ];

  return (
    <div className="space-y-6 pt-4">

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">{t('customers.title')}</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
            {t('customers.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, alignSelf: 'flex-start' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)',
            borderRadius: 12,
            border: '1px solid rgba(56,189,248,0.2)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d39980' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {t('customers.masterAdminOnly')}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(37,99,235,0.3)';
            }}
          >
            <Plus size={18} />
            {t('customers.addCustomer')}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '20px 22px',
                border: kpi.accent ? '1.5px solid rgba(248,113,113,0.3)' : '1px solid #e5e7eb',
                position: 'relative',
                overflow: 'hidden',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
            >
              {kpi.accent && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f87171', borderRadius: '16px 16px 0 0' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: kpi.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={22} style={{ color: kpi.iconColor }} />
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, color: '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {isLoading ? <span style={{ color: '#d1d5db' }}>—</span> : kpi.value}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── SEARCH + FILTER ── */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('customers.search')}
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                border: '1px solid #e5e7eb', borderRadius: 10,
                fontSize: 14, color: '#111827', outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1px solid #e5e7eb', borderRadius: 10,
              fontSize: 14, color: '#374151', background: 'white',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">{t('customers.allStatus')}</option>
            <option value="active">{t('customers.active')}</option>
            <option value="trial">{t('customers.trial')}</option>
            <option value="inactive">{t('customers.inactive')}</option>
          </select>
        </div>

        {/* ── LIST ── */}
        <div style={{ padding: '12px 16px 16px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 120, background: '#f9fafb', borderRadius: 14, animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <AlertCircle size={40} style={{ color: '#fca5a5', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>{t('customers.errorLoading')}</p>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{error}</p>
              <button
                onClick={fetchCompanies}
                style={{ padding: '8px 18px', background: '#2563eb', color: 'white', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                {t('common.tryAgain')}
              </button>
            </div>
          ) : customers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Building2 size={40} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500 }}>{t('customers.notFound')}</p>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{ marginTop: 12, padding: '8px 18px', background: '#2563eb', color: 'white', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                {t('customers.addFirst')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customers.map(customer => {
                const displayName = customer.customer_type === 'yacht_owner' ? customer.yacht_name : customer.name;
                const vessel = customer.vessels?.[0];
                const sc = STATUS_STYLES[customer.subscription_status] || STATUS_STYLES.inactive;

                const navBtns = [
                  { label: t('customers.viewVessels'), page: 'vessels', params: { companyId: customer.id, companyName: customer.name }, primary: true },
                  { label: 'Maintenance', page: 'maintenance', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: 'History', page: 'history', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: 'Equipment', page: 'equipment', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: 'Water Toys', page: 'water-toys', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: 'Fuel', page: 'fuel', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: 'Costs', page: 'costs', params: { companyId: customer.id, companyName: customer.name }, primary: false },
                  { label: t('customers.manageUsers'), page: 'users', params: { companyId: customer.id }, primary: false },
                ];

                return (
                  <div
                    key={customer.id}
                    style={{
                      borderRadius: 16,
                      border: '1px solid #e5e7eb',
                      overflow: 'hidden',
                      display: 'flex',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#bae6fd';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.07)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    {/* Photo / avatar column */}
                    <div style={{ width: 160, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                      {vessel?.photo_url ? (
                        <>
                          <img src={vessel.photo_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.08))' }} />
                        </>
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', minHeight: 140,
                          background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Building2 size={36} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        </div>
                      )}
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, padding: '18px 20px', minWidth: 0 }}>

                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                              {displayName}
                            </h3>
                            <span style={{
                              padding: '2px 9px', borderRadius: 100, flexShrink: 0,
                              background: customer.customer_type === 'agency' ? '#eff6ff' : '#f0fdf4',
                              color: customer.customer_type === 'agency' ? '#1d4ed8' : '#15803d',
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                              {customer.customer_type === 'agency' ? 'Agency' : 'Yacht'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                              <Mail size={12} />
                              {customer.contact_email}
                            </div>
                            {customer.contact_phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                <Phone size={12} />
                                {customer.contact_phone}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '4px 12px', borderRadius: 100,
                            background: sc.bg, color: sc.text,
                            fontSize: 12, fontWeight: 700,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                            {customer.subscription_status.charAt(0).toUpperCase() + customer.subscription_status.slice(1)}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); handleEditCustomer(customer); }}
                            style={{ padding: 7, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', transition: 'background 0.15s, color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; (e.currentTarget as HTMLButtonElement).style.color = '#2563eb'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                            disabled={deletingId === customer.id}
                            style={{ padding: 7, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', transition: 'background 0.15s, color 0.15s', opacity: deletingId === customer.id ? 0.5 : 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('customers.contactPerson')}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>{customer.contact_name}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('customers.renewalDate')}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>{formatDate(customer.subscription_renewal_date)}</div>
                        </div>
                        {customer.customer_type === 'yacht_owner' ? (
                          <>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Ruler size={10} /> {t('vessels.loa')}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                                {vessel?.length_overall != null ? `${vessel.length_overall} m` : '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Weight size={10} /> {t('customers.grossTonnage')}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 2 }}>
                                {vessel?.gross_tonnage != null ? `${vessel.gross_tonnage} GT` : '—'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('customers.vessels')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ color: '#2563eb' }}>{customer.vessels?.length ?? 0}</span>
                                <span style={{ color: '#9ca3af', fontWeight: 500 }}> / {customer.vessel_limit}</span>
                              </span>
                              <div style={{ width: 56, height: 5, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(((customer.vessels?.length ?? 0) / customer.vessel_limit) * 100, 100)}%`,
                                  borderRadius: 99,
                                  background: (customer.vessels?.length ?? 0) >= customer.vessel_limit ? '#ef4444' : '#2563eb',
                                  transition: 'width 0.4s ease',
                                }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {customer.notes && (
                        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                          <p style={{ fontSize: 12, color: '#6b7280' }}>{customer.notes}</p>
                        </div>
                      )}

                      {/* Nav buttons */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                        {navBtns.map(btn => (
                          <button
                            key={btn.page + btn.label}
                            onClick={e => { e.stopPropagation(); onNavigate(btn.page, btn.params); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 8,
                              border: btn.primary ? 'none' : '1px solid #e5e7eb',
                              background: btn.primary ? '#2563eb' : 'white',
                              color: btn.primary ? 'white' : '#374151',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'background 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = btn.primary ? '#1d4ed8' : '#f9fafb';
                              if (!btn.primary) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = btn.primary ? '#2563eb' : 'white';
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { fetchCompanies(); setIsModalOpen(false); }}
      />
      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingCustomer(null); }}
        onSuccess={() => { fetchCompanies(); setIsEditModalOpen(false); setEditingCustomer(null); }}
        customer={editingCustomer}
      />
    </div>
  );
};
