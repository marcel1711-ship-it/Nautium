import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Anchor, Loader2, ChevronDown, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { demoMaintenanceManuals, demoVessels, demoUsers } from '../data/demoData';

const isDemoUser = (email: string) => demoUsers.some((u: any) => u.email === email);

const CHAT_EDGE_URL = `${SUPABASE_URL}/functions/v1/nautius-chat`;
const EDGE_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

interface Manual {
  id: string;
  title: string;
  file_url: string;
  vessel_id: string;
  equipment_id: string | null;
}

const C = {
  bg:      '#050e1a',
  bg2:     '#0a1828',
  bg3:     '#0d2040',
  teal:    '#5cc4b0',
  tealMid: '#8ab4b4',
  tealDim: 'rgba(92,196,176,0.12)',
  border:  'rgba(138,180,180,0.12)',
  border2: 'rgba(138,180,180,0.07)',
  textHigh:'#e8f2f2',
  textMid: '#b0cccc',
  textLow: '#7a9898',
};

const SYSTEM_PROMPT = `You are Nautius, the AI assistant for Nautium — a professional yacht fleet management platform. You are a highly experienced marine engineer and technical advisor with deep knowledge of yacht systems, maintenance procedures, troubleshooting, and maritime operations.

Your role:
- Answer technical questions about yacht maintenance, systems, and troubleshooting
- Use the provided manual content as your primary source of truth
- If manual content is provided, reference it specifically in your answers
- Respond in the same language the user writes in (English or Spanish)
- Be concise but thorough — engineers need actionable information
- For owners (non-technical users), explain things simply without jargon
- Always prioritize safety in your recommendations
- If you don't have enough information from the manuals, say so and provide general best practices

Tone: Professional, calm, knowledgeable. Like a trusted chief engineer you can call at any hour.`;

export const NautiusChat: React.FC = () => {
  const { currentUser, selectedVesselId, sessionReady } = useAuth();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [vesselName, setVesselName] = useState('');
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentUser && sessionReady) loadManuals();
  }, [currentUser, selectedVesselId, sessionReady]);

  const buildGreeting = () => {
    const firstName = currentUser?.full_name
      ? `, ${currentUser.full_name.split(' ')[0]}`
      : '';
    const vesselSuffix = vesselName ? ` (${vesselName})` : '';
    const pluralWord = language === 'es'
      ? manuals.length !== 1 ? 'manuales' : 'manual'
      : manuals.length !== 1 ? 'manuals' : 'manual';

    if (currentUser?.role === 'owner') {
      return t('chat.greetingOwner').replace('{name}', firstName);
    }
    return t('chat.greetingCrew')
      .replace('{name}', firstName)
      .replace('{count}', String(manuals.length))
      .replace('{plural}', pluralWord)
      .replace('{vessel}', vesselSuffix);
  };

  const isOnlyGreeting = (msgs: Message[]) =>
    msgs.length === 1 && msgs[0].id === 'greeting';

  useEffect(() => {
    if (!open) return;
    if (messages.length === 0 || isOnlyGreeting(messages)) {
      setMessages([{ id: 'greeting', role: 'assistant', content: buildGreeting() }]);
    }
  }, [open, language, manuals, vesselName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadManuals = async () => {
    if (!currentUser) return;
    const vesselId = selectedVesselId || currentUser.vessel_ids?.[0];
    if (!vesselId) return;

    const demoVessel = demoVessels.find((v: any) => v.id === vesselId);
    if (isDemoUser(currentUser.email) && demoVessel) {
      setVesselName(demoVessel.name || '');
      setManuals(
        (demoMaintenanceManuals as any[]).filter(m => m.vessel_id === vesselId) as Manual[]
      );
      return;
    }

    const { data: vesselData } = await supabase
      .from('vessels').select('name').eq('id', vesselId).maybeSingle();
    setVesselName(vesselData?.name || '');

    const { data, error } = await supabase
      .from('maintenance_manuals')
      .select('id, title, file_url, vessel_id, equipment_id')
      .eq('vessel_id', vesselId);
    if (error) console.error('[NautiusChat] manuals fetch error:', error);
    setManuals(data || []);
  };

  const fetchManualContent = async (manual: Manual): Promise<string | null> => {
    if (!manual.file_url || manual.file_url.startsWith('/')) return null;
    try {
      const response = await fetch(manual.file_url);
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('pdf')) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');

    // ✅ FIX 1: Capturamos el historial ANTES de modificar el estado,
    // filtrando correctamente el saludo y mensajes vacíos/loading
    const conversationHistory = messages
      .filter(m => !m.loading && m.id !== 'greeting' && m.content.trim() !== '')
      .map(m => ({ role: m.role, content: m.content }));

    const newMessages: Message[] = [
      ...messages,
      { id: Date.now().toString(), role: 'user', content: userMessage },
      { id: `${Date.now() + 1}`, role: 'assistant', content: '', loading: true },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const manualContext = manuals.length > 0
        ? `Available manuals for this vessel: ${manuals.map(m => m.title).join(', ')}.`
        : 'No manuals uploaded for this vessel yet.';
      const vesselContext = vesselName ? `Current vessel: ${vesselName}.` : '';
      const roleContext = currentUser?.role === 'owner'
        ? 'Note: The user is the vessel owner (not a technician). Use simple, non-technical language.'
        : `User role: ${currentUser?.role || 'crew'}.`;
      const langContext = language === 'es'
        ? 'IMPORTANT: Always respond in Spanish (Español). The user interface is in Spanish.'
        : 'IMPORTANT: Always respond in English. The user interface is in English.';
      const systemWithContext = `${SYSTEM_PROMPT}\n\n${vesselContext} ${manualContext} ${roleContext} ${langContext}`;

      const manualContents: { title: string; base64: string }[] = [];
      for (const manual of manuals.slice(0, 2)) {
        const base64 = await fetchManualContent(manual);
        if (base64) manualContents.push({ title: manual.title, base64 });
      }

      let userContent: any = userMessage;
      if (manualContents.length > 0) {
        userContent = [
          ...manualContents.map(mc => ({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: mc.base64 },
            title: mc.title,
          })),
          { type: 'text', text: userMessage },
        ];
      }

      // ✅ FIX 2: El array de messages siempre tiene al menos el mensaje del usuario,
      // nunca llega vacío a la Edge Function
      const messagesPayload = [
        ...conversationHistory,
        { role: 'user', content: userContent },
      ];

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(CHAT_EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
          'Apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          system: systemWithContext,
          messages: messagesPayload,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('[NautiusChat] API error:', data.error);
        const errMsg = data.error.includes('not configured')
          ? t('chat.notConfigured')
          : `${t('chat.genericError')} (${typeof data.error === 'string' ? data.error.slice(0, 120) : 'unknown'})`;
        setMessages(prev =>
          prev.map(m => m.loading ? { ...m, content: errMsg, loading: false } : m)
        );
      } else {
        const assistantText =
          data.content?.[0]?.text || t('chat.genericError');
        setMessages(prev =>
          prev.map(m => m.loading ? { ...m, content: assistantText, loading: false } : m)
        );
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.loading ? { ...m, content: t('chat.connectionError'), loading: false } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: C.teal, fontWeight: 600 }}>{part}</strong>
        : part
    );
  };

  if (!currentUser) return null;

  const suggestions = currentUser.role === 'owner'
    ? [t('chat.suggest.engineNoise'), t('chat.suggest.smell'), t('chat.suggest.departure')]
    : [t('chat.suggest.oilChange'), t('chat.suggest.generator'), t('chat.suggest.schedule')];

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title={t('chat.buttonTitle')}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0a1828, #0d2040)',
            border: '1px solid rgba(92,196,176,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(92,196,176,0.15), 0 0 20px rgba(92,196,176,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(92,196,176,0.3), 0 0 30px rgba(92,196,176,0.2)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(92,196,176,0.15), 0 0 20px rgba(92,196,176,0.1)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          <Anchor size={22} color={C.teal} strokeWidth={2} />
        </button>
      )}

      {/* Ventana del chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 380, maxWidth: 'calc(100vw - 32px)',
          height: minimized ? 'auto' : 560,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(92,196,176,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'SF Pro Display', system-ui, sans-serif",
        }}>

          {/* Header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.bg3} 0%, ${C.bg2} 100%)`,
              borderBottom: `1px solid ${C.border}`,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', flexShrink: 0,
            }}
            onClick={() => setMinimized(m => !m)}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8ab4b4, #4a8080)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(138,180,180,.3)',
              boxShadow: '0 0 12px rgba(92,196,176,.2)',
              flexShrink: 0,
            }}>
              <Anchor size={15} color="#050e1a" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textHigh, letterSpacing: '.3px' }}>
                {t('chat.title')}
              </div>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {t('chat.subtitle')}
              </div>
            </div>
            {manuals.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: C.tealDim, border: '1px solid rgba(92,196,176,.2)',
                borderRadius: 100, padding: '3px 8px',
              }}>
                <BookOpen size={10} color={C.teal} />
                <span style={{ fontSize: 10, fontWeight: 600, color: C.teal }}>{manuals.length}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={e => { e.stopPropagation(); setMinimized(m => !m); }}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'rgba(138,180,180,.08)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: C.textLow,
                }}
              >
                <ChevronDown size={14} style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpen(false); setMessages([]); }}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'rgba(138,180,180,.08)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: C.textLow,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Mensajes */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 14px',
                display: 'flex', flexDirection: 'column', gap: 12,
                scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent`,
              }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: 8, alignItems: 'flex-end',
                  }}>
                    {msg.role === 'assistant' && (
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8ab4b4, #4a8080)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Anchor size={11} color="#050e1a" strokeWidth={2.5} />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '78%',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, #0d2040, #0a1828)'
                        : C.bg2,
                      border: `1px solid ${msg.role === 'user' ? 'rgba(92,196,176,.2)' : C.border}`,
                      borderRadius: msg.role === 'user'
                        ? '16px 16px 4px 16px'
                        : '16px 16px 16px 4px',
                      padding: '10px 13px',
                    }}>
                      {msg.loading ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
                          {[0, 1, 2].map(i => (
                            <div key={i} style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: C.teal, opacity: 0.6,
                              animation: `nautiusPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }} />
                          ))}
                        </div>
                      ) : (
                        <p style={{
                          fontSize: 13, color: C.textMid, lineHeight: 1.6,
                          margin: 0, whiteSpace: 'pre-wrap',
                        }}>
                          {renderContent(msg.content)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Sugerencias rápidas */}
              {messages.length <= 1 && (
                <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      style={{
                        fontSize: 11, fontWeight: 500, color: C.tealMid,
                        background: C.tealDim, border: '1px solid rgba(92,196,176,.15)',
                        borderRadius: 100, padding: '4px 10px', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                borderTop: `1px solid ${C.border}`,
                padding: '12px 14px',
                background: C.bg2,
                display: 'flex', gap: 8, alignItems: 'flex-end',
                flexShrink: 0,
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.placeholder')}
                  rows={1}
                  style={{
                    flex: 1, background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12, padding: '9px 12px',
                    color: C.textHigh, fontSize: 13,
                    resize: 'none', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5,
                    maxHeight: 100, overflowY: 'auto',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(92,196,176,.4)')}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: input.trim() && !loading
                      ? 'linear-gradient(135deg, #5cc4b0, #4ab4a0)'
                      : 'rgba(138,180,180,.08)',
                    border: 'none',
                    cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                  }}
                >
                  {loading
                    ? <Loader2 size={16} color={C.teal} style={{ animation: 'nautiusSpin 1s linear infinite' }} />
                    : <Send size={15} color={input.trim() ? '#050e1a' : C.textLow} />
                  }
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes nautiusPulse {
          0%, 100% { transform: scale(1); opacity: .6; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        @keyframes nautiusSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
