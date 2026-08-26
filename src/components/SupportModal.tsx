import React, { useState, useEffect } from 'react';
import { X, Send, LifeBuoy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { fetchByCompany } from '../lib/supabase';

interface SupportModalProps {
  onClose: () => void;
}

type Priority = 'normal' | 'high' | 'urgent';
type Status = 'idle' | 'sending' | 'sent' | 'error';

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const isEs = language === 'es';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [vesselName, setVesselName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vessels, setVessels] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentUser?.company_id) return;
    fetchByCompany('vessels', currentUser.company_id, 'name', true)
      .then((data: any[]) => {
        const v = data.map(d => ({ id: d.id, name: d.name }));
        setVessels(v);
        if (v.length === 1) setVesselName(v[0].name);
      })
      .catch(() => {});

    supabase.from('companies').select('name').eq('id', currentUser.company_id).single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-support-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          userName: currentUser?.full_name || '',
          userEmail: currentUser?.email || '',
          companyName,
          vesselName,
          subject: subject.trim(),
          message: message.trim(),
          priority,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to send');
      }

      setStatus('sent');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Failed to send support request');
    }
  };

  if (status === 'sent') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440,
          padding: 40, textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          animation: 'fadeInScale 0.3s ease',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#ecfdf5', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
            {isEs ? 'Mensaje enviado' : 'Message sent'}
          </h3>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
            {isEs
              ? 'Nuestro equipo revisará tu solicitud y te responderá lo antes posible.'
              : 'Our team will review your request and get back to you as soon as possible.'}
          </p>
          <button onClick={onClose} style={{
            background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            {isEs ? 'Cerrar' : 'Close'}
          </button>
        </div>
        <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  const priorities: { value: Priority; label: string; labelEs: string; color: string }[] = [
    { value: 'normal', label: 'Normal', labelEs: 'Normal', color: '#10b981' },
    { value: 'high', label: 'High', labelEs: 'Alta', color: '#f59e0b' },
    { value: 'urgent', label: 'Urgent', labelEs: 'Urgente', color: '#ef4444' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        animation: 'fadeInScale 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          padding: '28px 28px 24px', color: '#fff', position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #22d3ee, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LifeBuoy size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                {isEs ? 'Soporte Nautium' : 'Nautium Support'}
              </h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
                {isEs ? 'Cuéntanos cómo podemos ayudarte' : 'Tell us how we can help'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px' }}>
          {/* User info (read-only) */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{isEs ? 'Nombre' : 'Name'}</label>
              <div style={readOnlyStyle}>{currentUser?.full_name || ''}</div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{isEs ? 'Empresa' : 'Company'}</label>
              <div style={readOnlyStyle}>{companyName || '—'}</div>
            </div>
          </div>

          {/* Vessel */}
          {vessels.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{isEs ? 'Barco (opcional)' : 'Vessel (optional)'}</label>
              <select
                value={vesselName}
                onChange={e => setVesselName(e.target.value)}
                style={inputStyle}
              >
                <option value="">{isEs ? 'Seleccionar barco...' : 'Select vessel...'}</option>
                {vessels.map(v => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Priority */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{isEs ? 'Prioridad' : 'Priority'}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {priorities.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10, border: '2px solid',
                    borderColor: priority === p.value ? p.color : '#e2e8f0',
                    background: priority === p.value ? `${p.color}12` : '#fff',
                    color: priority === p.value ? p.color : '#64748b',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {isEs ? p.labelEs : p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{isEs ? 'Asunto' : 'Subject'}</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={isEs ? 'Breve descripción del problema...' : 'Brief description of the issue...'}
              style={inputStyle}
            />
          </div>

          {/* Message */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{isEs ? 'Mensaje *' : 'Message *'}</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={isEs
                ? 'Describe el problema o consulta con el mayor detalle posible...'
                : 'Describe the issue or question in as much detail as possible...'}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
            />
          </div>

          {/* Error */}
          {status === 'error' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fecaca',
              marginBottom: 16,
            }}>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#dc2626' }}>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || status === 'sending'}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: !message.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9, #22d3ee)',
              color: !message.trim() ? '#94a3b8' : '#fff',
              fontSize: 15, fontWeight: 700, cursor: !message.trim() ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              opacity: status === 'sending' ? 0.7 : 1,
            }}
          >
            <Send size={16} />
            {status === 'sending'
              ? (isEs ? 'Enviando...' : 'Sending...')
              : (isEs ? 'Enviar solicitud' : 'Send request')}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a',
  outline: 'none', transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

const readOnlyStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10,
  background: '#f8fafc', border: '1px solid #e2e8f0',
  fontSize: 14, color: '#334155',
};
