import React, { useState, useEffect } from 'react';
import {
  Ship, Search, AlertCircle, Mail, Phone, MapPin,
  CheckCircle, XCircle, Clock, Anchor, Building2, Eye,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';

interface Submission {
  id: string;
  submitted_at: string;
  status: 'pending' | 'processed' | 'rejected';
  customer_type: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  vessel_limit: number;
  vessel_name: string;
  vessel_type: string;
  current_location: string;
  manufacturer: string;
  model: string;
  year_built: number;
  flag_state: string;
  imo_number: string;
  mmsi: string;
  call_sign: string;
  registration_no: string;
  length_overall: number;
  beam: number;
  gross_tonnage: number;
  owner_name: string;
  owner_email: string;
  daily_alert_notifications: boolean;
  notes: string;
  token: string;
}

interface OnboardingSubmissionsProps {
  onNavigate: (page: string, params?: any) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:   { bg: '#fef9c3', text: '#854d0e', dot: '#d97706', label: 'Pending' },
  processed: { bg: '#dcfce7', text: '#15803d', dot: '#16a34a', label: 'Approved' },
  rejected:  { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626', label: 'Rejected' },
};

const VESSEL_TYPE_MAP: Record<string, string> = {
  'Motor Yacht': 'motor_yacht',
  'Sailing Yacht': 'sailing_yacht',
  'Catamaran': 'catamaran',
  'Explorer Yacht': 'explorer_yacht',
  'Superyacht': 'superyacht',
  'Gulet': 'gulet',
  'Other': 'other',
};

export const OnboardingSubmissions: React.FC<OnboardingSubmissionsProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'master_admin') fetchSubmissions();
  }, [currentUser]);

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('onboarding_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (fetchError) throw fetchError;
      setSubmissions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (submission: Submission) => {
    if (!confirm(`Approve ${submission.contact_name} and create their account in Nautium?`)) return;
    setProcessingId(submission.id);

    try {
      // 1. Create company
      const customerType = submission.customer_type === 'agency' ? 'agency' : 'yacht_owner';
      const companyName = submission.customer_type === 'agency'
        ? (submission.company_name || submission.contact_name)
        : submission.vessel_name;

      const renewalDate = new Date();
      renewalDate.setMonth(renewalDate.getMonth() + 3);

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          customer_type: customerType,
          yacht_name: submission.vessel_name || '',
          contact_name: submission.contact_name,
          contact_email: submission.contact_email,
          contact_phone: submission.contact_phone || '',
          subscription_status: 'trial',
          subscription_renewal_date: renewalDate.toISOString().split('T')[0],
          vessel_limit: submission.vessel_limit || 1,
          notes: submission.notes || '',
          email_notifications_enabled: submission.daily_alert_notifications || false,
          notification_emails: submission.owner_email ? [submission.owner_email] : [],
        })
        .select('id')
        .single();

      if (companyError) throw companyError;

      // 2. Create vessel
      const vesselType = VESSEL_TYPE_MAP[submission.vessel_type] || 'motor_yacht';

      const { error: vesselError } = await supabase
        .from('vessels')
        .insert({
          company_id: company.id,
          name: submission.vessel_name || 'Vessel',
          type: vesselType,
          manufacturer: submission.manufacturer || '',
          model: submission.model || '',
          year_built: submission.year_built || null,
          flag: submission.flag_state || '',
          imo_number: submission.imo_number || '',
          mmsi: submission.mmsi || '',
          call_sign: submission.call_sign || '',
          registration_id: submission.registration_no || '',
          length_overall: submission.length_overall || null,
          beam: submission.beam || null,
          gross_tonnage: submission.gross_tonnage || null,
          location: submission.current_location || '',
          owner_name: submission.owner_name || '',
          owner_email: submission.owner_email || '',
          notes: '',
          description: '',
        });

      if (vesselError) throw vesselError;

      // 3. Mark submission as processed
      await supabase
        .from('onboarding_submissions')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', submission.id);

      // 4. Update local state
      setSubmissions(prev => prev.map(s =>
        s.id === submission.id ? { ...s, status: 'processed' } : s
      ));

      showToast(`${submission.contact_name} approved! Company and vessel created. Remember to create their user account.`, 'success');

      // Navigate to customers to create user
      onNavigate('customers');

    } catch (err: any) {
      showToast('Failed to approve: ' + err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (submission: Submission) => {
    if (!confirm(`Reject ${submission.contact_name}'s application?`)) return;
    setRejectingId(submission.id);
    try {
      await supabase
        .from('onboarding_submissions')
        .update({ status: 'rejected' })
        .eq('id', submission.id);
      setSubmissions(prev => prev.map(s =>
        s.id === submission.id ? { ...s, status: 'rejected' } : s
      ));
    } catch (err: any) {
      showToast('Failed to reject: ' + err.message, 'error');
    } finally {
      setRejectingId(null);
    }
  };

  if (currentUser?.role !== 'master_admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Ship className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">Access Denied</p>
          <p className="text-gray-600">This page is only accessible to Master Admins</p>
        </div>
      </div>
    );
  }

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const processedCount = submissions.filter(s => s.status === 'processed').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  const filtered = submissions.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      s.contact_name?.toLowerCase().includes(term) ||
      s.contact_email?.toLowerCase().includes(term) ||
      s.vessel_name?.toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });

  const kpis = [
    { label: 'Total Submissions', value: submissions.length, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
    { label: 'Pending Review', value: pendingCount, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', highlight: pendingCount > 0 },
    { label: 'Approved', value: processedCount, color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    { label: 'Rejected', value: rejectedCount, color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  ];

  return (
    <div className="space-y-6 pt-4">

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Onboarding Submissions</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
            Beta program vessel applications
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)',
          borderRadius: 12,
          border: '1px solid rgba(56,189,248,0.2)',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d39980' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Master Admin Only
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '20px 22px',
              border: kpi.highlight ? `1.5px solid ${kpi.color}40` : '1px solid #e5e7eb',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {kpi.highlight && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpi.color, borderRadius: '16px 16px 0 0' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ship size={22} style={{ color: kpi.color }} />
              </div>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                {isLoading ? <span style={{ color: '#d1d5db' }}>—</span> : kpi.value}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* LIST */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden' }}>

        {/* Search + Filter */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, vessel..."
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                border: '1px solid #e5e7eb', borderRadius: 10,
                fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, color: '#374151', background: 'white', cursor: 'pointer', outline: 'none' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processed">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={fetchSubmissions}
            style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#374151', background: 'white', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>

        {/* Submissions */}
        <div style={{ padding: '12px 16px 16px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 100, background: '#f9fafb', borderRadius: 14 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <AlertCircle size={40} style={{ color: '#fca5a5', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Error loading submissions</p>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{error}</p>
              <button onClick={fetchSubmissions} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Try Again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Ship size={40} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500 }}>No submissions found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(s => {
                const sc = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
                const isExpanded = expandedId === s.id;
                const isProcessing = processingId === s.id;
                const isRejecting = rejectingId === s.id;

                return (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: 16,
                      border: s.status === 'pending' ? '1.5px solid #fbbf2440' : '1px solid #e5e7eb',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  >
                    {/* Main row */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>

                      {/* Icon */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {s.customer_type === 'agency' ? <Building2 size={22} style={{ color: 'white' }} /> : <Anchor size={22} style={{ color: 'white' }} />}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>{s.contact_name}</h3>
                              <span style={{
                                padding: '2px 9px', borderRadius: 100,
                                background: s.customer_type === 'agency' ? '#eff6ff' : '#f0fdf4',
                                color: s.customer_type === 'agency' ? '#1d4ed8' : '#15803d',
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                              }}>
                                {s.customer_type === 'agency' ? 'Agency' : 'Yacht Owner'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                <Mail size={12} />{s.contact_email}
                              </div>
                              {s.contact_phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                  <Phone size={12} />{s.contact_phone}
                                </div>
                              )}
                              {s.vessel_name && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                  <Ship size={12} /><strong style={{ color: '#111827' }}>{s.vessel_name}</strong>{s.vessel_type ? ` · ${s.vessel_type}` : ''}
                                </div>
                              )}
                              {s.current_location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                                  <MapPin size={12} />{s.current_location}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 100, background: sc.bg, color: sc.text, fontSize: 12, fontWeight: 700 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                              {sc.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9ca3af' }}>
                              <Clock size={11} />
                              {new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                          {s.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(s)}
                                disabled={isProcessing}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '7px 16px',
                                  background: isProcessing ? '#d1d5db' : 'linear-gradient(135deg, #16a34a, #15803d)',
                                  color: 'white', border: 'none', borderRadius: 10,
                                  fontSize: 13, fontWeight: 700, cursor: isProcessing ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <CheckCircle size={14} />
                                {isProcessing ? 'Creating...' : 'Approve & Create Customer'}
                              </button>
                              <button
                                onClick={() => handleReject(s)}
                                disabled={isRejecting}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '7px 14px',
                                  background: 'white', color: '#dc2626',
                                  border: '1px solid #fecaca', borderRadius: 10,
                                  fontSize: 13, fontWeight: 600, cursor: isRejecting ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <XCircle size={14} />
                                {isRejecting ? 'Rejecting...' : 'Reject'}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px',
                              background: 'white', color: '#374151',
                              border: '1px solid #e5e7eb', borderRadius: 10,
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <Eye size={14} />
                            {isExpanded ? 'Hide details' : 'View details'}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, paddingTop: 16 }}>
                          {[
                            { label: 'Manufacturer', value: s.manufacturer },
                            { label: 'Model', value: s.model },
                            { label: 'Year Built', value: s.year_built },
                            { label: 'Flag State', value: s.flag_state },
                            { label: 'IMO Number', value: s.imo_number },
                            { label: 'MMSI', value: s.mmsi },
                            { label: 'Call Sign', value: s.call_sign },
                            { label: 'Registration No.', value: s.registration_no },
                            { label: 'LOA (m)', value: s.length_overall },
                            { label: 'Beam (m)', value: s.beam },
                            { label: 'Gross Tonnage', value: s.gross_tonnage },
                            { label: 'Owner Name', value: s.owner_name },
                            { label: 'Owner Email', value: s.owner_email },
                            { label: 'Daily Alerts', value: s.daily_alert_notifications ? 'Yes' : 'No' },
                          ].filter(f => f.value).map(field => (
                            <div key={field.label}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                                {field.label}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{String(field.value)}</div>
                            </div>
                          ))}
                          {s.notes && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Notes</div>
                              <div style={{ fontSize: 13, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>{s.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
