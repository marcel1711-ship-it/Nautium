import React, { useState, useEffect, useRef } from 'react';
import {
  Anchor, ChevronDown, Wrench, Package, Fuel, BookOpen, Users, BarChart3,
  Bell, ArrowRight, Menu, X, Check, Globe, Shield, MapPin, Zap,
  DollarSign, TrendingDown, Boxes, QrCode, Languages, Lock,
} from 'lucide-react';
interface LandingProps { onEnterApp: () => void; }
type Lang = 'en' | 'es';
const T = {
  en: {
    nav: { features: 'Features', howItWorks: 'How it works', forWho: "Who it's for", nautius: 'Nautius AI', contact: 'Contact', signIn: 'Log in', requestDemo: 'Request Demo' },
    hero: {
      badge: 'Complete Vessel Management Platform',
      bilingual: 'The only yacht platform in English & Spanish',
      nautiusBadge: 'Nautius AI — diagnose faults from your vessel\'s manuals',
      h1a: 'One platform.',
      h1b: 'Every department.',
      sub: 'From engine room to galley. Nautium gives every department their own space — maintenance, inventory, fuel, and costs — with real-time alerts, bilingual support, and Nautius AI for on-board diagnostics.',
      cta: 'Request a Demo',
      ctaSecondary: 'See how it works',
    },
    stats: [
      { val: 'EN / ES', label: 'The only bilingual yacht platform' },
      { val: '5', label: 'Departments — Deck, Engineering, Interior, Galley & Safety' },
      { val: 'Nautius', label: 'AI diagnostics from your manuals' },
    ],
    difference: {
      badge: 'Why Nautium',
      title: 'Built for the entire crew. Not just engineering.',
      sub: "Every other platform was built for the engineer. Nautium is built for the whole vessel — Deck, Interior, Engineering, Galley and Safety — each department with their own view, their own tasks, their own inventory.",
      points: [
        { icon: 'Languages', title: 'The only bilingual platform', desc: 'Full English and Spanish support — UI, alerts, reports, and forms. Switch in one click. No other yacht management software does this.', highlight: true },
        { icon: 'Shield', title: 'Department separation', desc: 'Each crew member sees only their department. The deck officer sees deck tasks and inventory. The chef sees galley stock. The captain sees everything. No more noise.', highlight: true },
        { icon: 'QrCode', title: 'QR code location system', desc: 'Generate QR codes for physical storage compartments onboard. Scan to identify the location instantly. No other platform has this built in.' },
        { icon: 'Zap', title: 'Auto-deduction on task completion', desc: 'When a technician logs parts used in maintenance, inventory updates automatically. No double entry, no forgotten stock movements.' },
      ],
    },
    features: {
      badge: 'Platform capabilities',
      title: 'Everything your vessel needs',
      sub: 'Eight fully integrated modules — built for every department, not just the engine room.',
      items: [
        { title: 'Fleet Management', desc: 'Centralize every vessel. Specs, documents, photos, and crew from a single command center.' },
        { title: 'Preventive Maintenance', desc: 'Schedule and track tasks by department. Engineering, Deck, Interior — each team manages their own.' },
        { title: 'Inventory Control', desc: 'Real-time stock levels by department and location. QR scanning for instant adjustments at sea.' },
        { title: 'Fuel & Consumables', desc: 'Log every fuel entry, track consumption trends, and optimize bunkering with historical data.' },
        { title: 'Digital Manuals', desc: 'Upload and organize technical manuals by vessel and equipment. Always accessible, never misplaced.' },
        { title: 'Smart Alerts', desc: 'Automated daily email digests for overdue tasks, low stock, and critical maintenance reminders.' },
        { title: 'Multi-User Access', desc: 'Role-based permissions by department. Engineers see engineering. Stewardesses see interior. Captains see all.' },
        { title: 'Cost Tracking', desc: 'Fuel, parts, external service, and operational costs — consolidated in one financial view per vessel.' },
      ],
    },
    costs: {
      badge: 'Financial visibility',
      title: 'Know exactly what your vessel costs',
      sub: 'Every fuel purchase, spare part consumed, and external service — automatically tracked and attributed. No more end-of-month surprises.',
      tab1: 'Period Costs', tab2: 'Inventory Value',
      points: [
        { title: 'Fuel & consumable spend', desc: 'Every bunkering entry with a price becomes a cost line automatically.' },
        { title: 'Parts consumed in maintenance', desc: 'When a technician logs parts used, cost is captured at unit price — no manual entry.' },
        { title: 'External service costs', desc: 'Record technician fees when closing a maintenance task. Full service cost picture.' },
        { title: 'Operational expenses', desc: 'Log mooring, utilities, insurance, port fees, and anything else that belongs to the vessel.' },
        { title: 'Inventory valuation', desc: 'Every item in stock valued at its unit cost. Know your onboard asset exposure at a glance.' },
      ],
      cta: 'See it in action',
    },
    howItWorks: {
      badge: 'Simple process',
      title: 'Up and running in hours, not weeks',
      steps: [
        { num: '01', title: 'Register your vessel', desc: 'Add your vessels with all technical details, photos, and documentation in minutes.' },
        { num: '02', title: 'Set up your crew', desc: 'Invite crew members by department. Engineers see engineering. Deck officers see deck. Everyone sees what they need.' },
        { num: '03', title: 'Operate with full control', desc: 'Log maintenance, manage inventory, track fuel, and receive alerts — every department, one platform.' },
      ],
    },
    forWho: {
      badge: 'Tailored for',
      title: 'Built for the people who run vessels',
      profiles: [
        { title: 'Captains & Owners', desc: 'See the full picture at a glance. Every department, every task, every cost — without asking the crew for updates. Full oversight, zero micromanagement.' },
        { title: 'Chief Engineers & Officers', desc: 'Stop managing your department with spreadsheets and WhatsApp. Maintenance schedules, inventory, manuals and alerts — all in one place, always up to date.' },
        { title: 'Chief Stewardesses & Chefs', desc: 'Interior and galley finally get their own space. Track your inventory, manage your tasks, and never run out of stock mid-charter again.' },
      ],
    },
    trust: {
      label: 'Built for demanding operations',
      items: [
        { label: 'Department separation', sub: 'Every crew member sees their space' },
        { label: 'Available worldwide', sub: 'Any port, any ocean' },
        { label: 'Real-time alerts', sub: 'Daily email digests' },
        { label: 'Bilingual EN / ES', sub: 'Switch in one click' },
      ],
    },
    cta: {
      title: 'Ready to take command?',
      sub: 'Whether you manage one vessel or a full fleet — give every department the tool they deserve. Starting today.',
      btn: 'Request a Demo', btnSecondary: 'Log in',
    },
    footer: {
      desc: 'The complete vessel management platform for professional yacht crews. The only one built for every department — in English and Spanish.',
      platform: 'Platform', account: 'Account',
      links: [['Features', '#features'], ['How it works', '#how-it-works'], ["Who it's for", '#for-who'], ['Nautius AI', '#nautius']],
      signIn: 'Log in', requestDemo: 'Request demo', rights: 'All rights reserved.',
    },
    scroll: 'Scroll',
  },
  es: {
    nav: { features: 'Funciones', howItWorks: 'Cómo funciona', forWho: 'Para quién', nautius: 'Nautius IA', contact: 'Contacto', signIn: 'Iniciar sesión', requestDemo: 'Solicitar Demo' },
    hero: {
      badge: 'Plataforma Completa de Gestión Naval',
      bilingual: 'La única plataforma náutica en español e inglés',
      nautiusBadge: 'Nautius IA — diagnostica averías desde los manuales de tu barco',
      h1a: 'Una plataforma.',
      h1b: 'Cada departamento.',
      sub: 'Desde la sala de máquinas hasta la cocina. Nautium da a cada departamento su propio espacio — mantenimiento, inventario, combustible y costes — con alertas en tiempo real, soporte bilingüe y Nautius IA a bordo.',
      cta: 'Solicitar Demo',
      ctaSecondary: 'Ver cómo funciona',
    },
    stats: [
      { val: 'ES / EN', label: 'La única plataforma náutica bilingüe' },
      { val: '5', label: 'Departamentos — Cubierta, Ingeniería, Interior, Cocina y Seguridad' },
      { val: 'Nautius', label: 'Diagnóstico IA desde tus manuales' },
    ],
    difference: {
      badge: 'Por qué Nautium',
      title: 'Hecho para toda la tripulación. No solo para ingeniería.',
      sub: 'Todas las demás plataformas se construyeron para el ingeniero. Nautium está hecho para todo el barco — Cubierta, Interior, Ingeniería, Cocina y Seguridad — cada departamento con su propia vista, sus tareas y su inventario.',
      points: [
        { icon: 'Languages', title: 'La única plataforma bilingüe', desc: 'Soporte completo en español e inglés — interfaz, alertas, reportes y formularios. Cambia con un clic. Ninguna otra plataforma náutica ofrece esto.', highlight: true },
        { icon: 'Shield', title: 'Separación por departamentos', desc: 'Cada tripulante ve solo su departamento. El oficial de cubierta ve tareas e inventario de cubierta. El chef ve el stock de cocina. El capitán lo ve todo. Sin ruido.', highlight: true },
        { icon: 'QrCode', title: 'Sistema QR para ubicaciones', desc: 'Genera códigos QR para los compartimentos de almacenamiento a bordo. Escanea para identificar la ubicación al instante. Ninguna otra plataforma tiene esto integrado.' },
        { icon: 'Zap', title: 'Deducción automática al completar tareas', desc: 'Cuando el técnico registra piezas usadas en mantenimiento, el inventario se actualiza solo. Sin doble entrada, sin movimientos olvidados.' },
      ],
    },
    features: {
      badge: 'Capacidades de la plataforma',
      title: 'Todo lo que tu embarcación necesita',
      sub: 'Ocho módulos completamente integrados — diseñados para cada departamento, no solo para la sala de máquinas.',
      items: [
        { title: 'Gestión de Flota', desc: 'Centraliza cada embarcación. Ficha técnica, documentos, fotos y tripulación desde un solo panel.' },
        { title: 'Mantenimiento Preventivo', desc: 'Programa y rastrea tareas por departamento. Ingeniería, Cubierta, Interior — cada equipo gestiona el suyo.' },
        { title: 'Control de Inventario', desc: 'Niveles de stock en tiempo real por departamento y ubicación. Escaneo QR para ajustes inmediatos a bordo.' },
        { title: 'Combustible y Consumibles', desc: 'Registra cada carga, analiza el consumo y optimiza el avituallamiento con datos históricos.' },
        { title: 'Manuales Digitales', desc: 'Sube y organiza manuales técnicos por embarcación y equipo. Siempre accesibles, nunca extraviados.' },
        { title: 'Alertas Inteligentes', desc: 'Resúmenes diarios por email para tareas vencidas, stock bajo y recordatorios de mantenimiento.' },
        { title: 'Acceso Multi-usuario', desc: 'Permisos por rol y departamento. Los ingenieros ven ingeniería. Las azafatas ven interior. El capitán ve todo.' },
        { title: 'Control de Costes', desc: 'Combustible, piezas, servicios externos y gastos operativos — en una vista financiera por embarcación.' },
      ],
    },
    costs: {
      badge: 'Visibilidad financiera',
      title: 'Sabe exactamente lo que cuesta tu embarcación',
      sub: 'Cada repostaje, cada pieza consumida y cada servicio externo — registrado y atribuido automáticamente. Sin sorpresas a fin de mes.',
      tab1: 'Costes del periodo', tab2: 'Valor de inventario',
      points: [
        { title: 'Gasto en combustible y consumibles', desc: 'Cada avituallamiento con precio se convierte en línea de coste automáticamente.' },
        { title: 'Piezas consumidas en mantenimiento', desc: 'Cuando el técnico registra piezas usadas, el coste se captura al precio unitario — sin entrada manual.' },
        { title: 'Costes de servicio externo', desc: 'Registra honorarios de técnicos al cerrar una tarea. Visión completa del coste de servicio.' },
        { title: 'Gastos operativos', desc: 'Registra amarre, servicios, seguros, tasas portuarias y todo lo que pertenece a la embarcación.' },
        { title: 'Valoración de inventario', desc: 'Cada artículo en stock valorado a su coste unitario. Conoce tu exposición de activos a bordo.' },
      ],
      cta: 'Verlo en acción',
    },
    howItWorks: {
      badge: 'Proceso simple',
      title: 'Operativo en horas, no en semanas',
      steps: [
        { num: '01', title: 'Registra tu embarcación', desc: 'Añade tus embarcaciones con todos los detalles técnicos, fotos y documentación en minutos.' },
        { num: '02', title: 'Configura tu tripulación', desc: 'Invita a los tripulantes por departamento. Los ingenieros ven ingeniería. Los oficiales de cubierta ven cubierta. Cada uno ve lo que necesita.' },
        { num: '03', title: 'Opera con control total', desc: 'Registra mantenimientos, gestiona inventario, controla combustible y recibe alertas — cada departamento, una plataforma.' },
      ],
    },
    forWho: {
      badge: 'Diseñado para',
      title: 'Hecho para quienes operan embarcaciones',
      profiles: [
        { title: 'Capitanes y Propietarios', desc: 'Ve el panorama completo de un vistazo. Cada departamento, cada tarea, cada coste — sin tener que preguntar a la tripulación. Control total, sin microgestión.' },
        { title: 'Jefes de Máquinas y Oficiales', desc: 'Deja de gestionar tu departamento con hojas de cálculo y WhatsApp. Mantenimiento, inventario, manuales y alertas — todo en un lugar, siempre actualizado.' },
        { title: 'Jefas de Azafatas y Chefs', desc: 'Interior y cocina por fin tienen su propio espacio. Controla tu inventario, gestiona tus tareas y no te quedes sin stock en medio de un charter.' },
      ],
    },
    trust: {
      label: 'Diseñado para operaciones exigentes',
      items: [
        { label: 'Separación por departamentos', sub: 'Cada tripulante ve su espacio' },
        { label: 'Disponible en todo el mundo', sub: 'Cualquier puerto, cualquier océano' },
        { label: 'Alertas en tiempo real', sub: 'Resúmenes diarios por email' },
        { label: 'Bilingüe ES / EN', sub: 'Cambia con un clic' },
      ],
    },
    cta: {
      title: '¿Listo para tomar el mando?',
      sub: 'Tanto si gestionas una embarcación como una flota entera — da a cada departamento la herramienta que merece. Empezando hoy.',
      btn: 'Solicitar Demo', btnSecondary: 'Iniciar sesión',
    },
    footer: {
      desc: 'La plataforma completa de gestión naval para tripulaciones profesionales. La única construida para cada departamento — en español e inglés.',
      platform: 'Plataforma', account: 'Cuenta',
      links: [['Funciones', '#features'], ['Cómo funciona', '#how-it-works'], ['Para quién', '#for-who'], ['Nautius IA', '#nautius']],
      signIn: 'Iniciar sesión', requestDemo: 'Solicitar demo', rights: 'Todos los derechos reservados.',
    },
    scroll: 'Bajar',
  },
};
const NAUTIUS_DEMO = {
  en: [
    { role: 'user', text: 'The port main engine is showing high coolant temperature alarm. What should I check first?' },
    { role: 'nautius', text: 'Based on the MTU 16V 4000 M93L manual for M/Y Azure Dream, high coolant temperature on the port main engine typically points to three causes:\n\n1. Raw water pump impeller failure — inspect and replace if worn (p. 4-23)\n2. Heat exchanger fouling — flush with descaling agent per procedure 5.3.1\n3. Thermostat stuck closed — test at 76°C opening point\n\nStart with the raw water flow check before opening the system. Would you like the step-by-step impeller inspection procedure?' },
    { role: 'user', text: 'Yes, give me the impeller procedure' },
    { role: 'nautius', text: 'Raw water pump impeller replacement — Port Main Engine:\n\n1. Stop engine and allow to cool (min. 20 min)\n2. Close raw water seacock\n3. Remove pump cover (4× M8 bolts, 13mm socket)\n4. Extract impeller with puller tool — no screwdrivers\n5. Inspect housing for scoring\n6. Install new impeller with blades curving in rotation direction\n7. Replace cover gasket — open seacock and check for leaks before restart\n\nPart: JABSCO-IMP-2056 — 2 units in stock, Engine Room Shelf B3' },
  ],
  es: [
    { role: 'user', text: 'El motor principal de babor marca alarma de alta temperatura de refrigerante. ¿Qué debo revisar primero?' },
    { role: 'nautius', text: 'Según el manual MTU 16V 4000 M93L del M/Y Azure Dream, la alta temperatura de refrigerante en el motor de babor suele tener tres causas:\n\n1. Fallo del impulsor de la bomba de agua de mar — inspeccionar y sustituir si está desgastado (p. 4-23)\n2. Suciedad en el intercambiador de calor — lavar con agente desincrutante según procedimiento 5.3.1\n3. Termostato bloqueado cerrado — verificar apertura a 76°C\n\nEmpieza revisando el flujo de agua de mar antes de abrir el sistema. ¿Quieres el procedimiento paso a paso para el impulsor?' },
    { role: 'user', text: 'Sí, dame el procedimiento del impulsor' },
    { role: 'nautius', text: 'Sustitución del impulsor — Motor Babor:\n\n1. Parar motor y dejar enfriar (mín. 20 min)\n2. Cerrar la toma de agua de mar\n3. Retirar tapa de la bomba (4× tornillos M8, llave 13mm)\n4. Extraer impulsor con extractor — no usar destornilladores\n5. Inspeccionar carcasa por rayaduras\n6. Instalar nuevo impulsor con paletas curvadas en dirección de giro\n7. Reemplazar junta — abrir toma y verificar estanqueidad antes de arrancar\n\nPieza: JABSCO-IMP-2056 — 2 unidades en stock, Estante B3 Sala de Máquinas' },
  ],
};
const FEATURE_ICONS = [Anchor, Wrench, Package, Fuel, BookOpen, Bell, Users, BarChart3];
const TRUST_ICONS = [Users, Globe, Bell, Languages];
const DIFF_ICONS: Record<string, React.ElementType> = { Languages, Shield, QrCode, Zap };
const DEMO_URL = 'https://demo.nautium.app/';

const PHOTOS = {
  hero: 'https://images.pexels.com/photos/5488927/pexels-photo-5488927.jpeg?auto=compress&cs=tinysrgb&w=1920',
  profiles: [
    'https://images.pexels.com/photos/8886818/pexels-photo-8886818.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/15452603/pexels-photo-15452603.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/10642986/pexels-photo-10642986.jpeg?auto=compress&cs=tinysrgb&w=800',
  ],
};

export const Landing: React.FC<LandingProps> = ({ onEnterApp }) => {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('nautium_lang') as Lang) || 'en'; } catch { return 'en'; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const t = T[lang];
  const nautiusDemo = NAUTIUS_DEMO[lang];
  const toggleLang = () => {
    setLang(l => {
      const next = l === 'en' ? 'es' : 'en';
      try { localStorage.setItem('nautium_lang', next); } catch {}
      return next;
    });
  };
  const openDemo = () => window.open(DEMO_URL, '_blank');
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };
  const navLinks = [
    { label: t.nav.features, href: '#features' },
    { label: t.nav.howItWorks, href: '#how-it-works' },
    { label: t.nav.forWho, href: '#for-who' },
    { label: t.nav.nautius, href: '#nautius' },
  ];

  const serif = 'Georgia, "Times New Roman", serif';

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <style>{`
        .n-serif { font-family: Georgia, "Times New Roman", serif; }
        .n-gold-line { position: relative; }
        .n-gold-line::after { content: ''; position: absolute; bottom: -6px; left: 0; width: 48px; height: 2px; background: #B8965A; }
        .n-gold-line-center::after { left: 50%; transform: translateX(-50%); }
        .n-section-light { background: #F6F4EE; color: #1E293B; }
        .n-section-dark { background: #0B1A2E; color: #E2E8F0; }
        .n-btn-primary { background: #1A5F7A; color: #fff; padding: 14px 36px; font-weight: 600; font-size: 14px; letter-spacing: 0.03em; transition: all 0.25s ease; border: none; cursor: pointer; }
        .n-btn-primary:hover { background: #165169; }
        .n-btn-outline { background: transparent; color: #1A5F7A; padding: 14px 36px; font-weight: 600; font-size: 14px; letter-spacing: 0.03em; border: 1.5px solid #1A5F7A; transition: all 0.25s ease; cursor: pointer; }
        .n-btn-outline:hover { background: #1A5F7A; color: #fff; }
        .n-btn-outline-light { color: #E2E8F0; border-color: rgba(255,255,255,0.3); }
        .n-btn-outline-light:hover { background: rgba(255,255,255,0.1); color: #fff; }
      `}</style>

      {/* NAVBAR */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(8px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
          padding: scrolled ? '14px 0' : '22px 0',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{ background: '#0B1A2E', borderRadius: 6 }}
            >
              <Anchor size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: scrolled ? '#0B1A2E' : '#fff' }}
            >
              Nautium
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-[13px] font-medium transition-colors duration-200"
                style={{ color: scrolled ? '#64748B' : 'rgba(255,255,255,0.65)' }}
                onMouseEnter={e => (e.currentTarget.style.color = scrolled ? '#0B1A2E' : '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = scrolled ? '#64748B' : 'rgba(255,255,255,0.65)')}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-colors duration-200"
              style={{
                color: scrolled ? '#64748B' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${scrolled ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}`,
              }}
            >
              <Globe size={12} />{lang === 'en' ? 'ES' : 'EN'}
            </button>
            <button
              onClick={onEnterApp}
              className="text-[13px] font-medium px-4 py-2 transition-colors duration-200"
              style={{ color: scrolled ? '#64748B' : 'rgba(255,255,255,0.65)' }}
            >
              {t.nav.signIn}
            </button>
            <button
              onClick={openDemo}
              className="n-btn-primary"
              style={{ padding: '10px 24px', fontSize: 13, borderRadius: 4 }}
            >
              {t.nav.requestDemo}
            </button>
          </div>

          <button
            className="md:hidden transition-colors"
            style={{ color: scrolled ? '#0B1A2E' : '#fff' }}
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden px-6 py-5 flex flex-col gap-4" style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            {navLinks.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)} className="text-left text-sm font-medium py-1" style={{ color: '#64748B' }}>
                {l.label}
              </button>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)' }} />
            <button onClick={toggleLang} className="flex items-center gap-2 text-sm font-medium py-1 w-fit" style={{ color: '#64748B' }}>
              <Globe size={14} />{lang === 'en' ? 'Español' : 'English'}
            </button>
            <button onClick={onEnterApp} className="text-left text-sm font-medium py-1" style={{ color: '#64748B' }}>{t.nav.signIn}</button>
            <button onClick={openDemo} className="n-btn-primary text-center" style={{ borderRadius: 4 }}>{t.nav.requestDemo}</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative min-h-screen flex items-end overflow-hidden" style={{ background: '#0B1A2E' }}>
        <div className="absolute inset-0 z-0">
          <img
            src={PHOTOS.hero}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.35 }}
          />
        </div>
        <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to right, #0B1A2E 0%, rgba(11,26,46,0.6) 50%, rgba(11,26,46,0.2) 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0 z-[1] h-32" style={{ background: 'linear-gradient(to top, #0B1A2E, transparent)' }} />

        <div className="relative z-[2] max-w-6xl mx-auto px-6 pb-24 pt-40 w-full">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-8" style={{ color: '#B8965A' }}>
              {t.hero.badge}
            </p>

            <h1 className="n-serif mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.08, color: '#fff', fontWeight: 400 }}>
              {t.hero.h1a}<br />
              <span style={{ fontStyle: 'italic', color: '#B8965A' }}>{t.hero.h1b}</span>
            </h1>

            <p className="mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, maxWidth: 520 }}>
              {t.hero.sub}
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 mb-16">
              <button onClick={openDemo} className="n-btn-primary flex items-center gap-2.5" style={{ borderRadius: 4 }}>
                {t.hero.cta}<ArrowRight size={15} />
              </button>
              <button onClick={() => scrollTo('#how-it-works')} className="n-btn-outline n-btn-outline-light" style={{ borderRadius: 4 }}>
                {t.hero.ctaSecondary}
              </button>
            </div>

            <div className="flex items-center gap-10 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {t.stats.map(s => (
                <div key={s.label}>
                  <div className="n-serif text-2xl" style={{ color: '#B8965A', fontWeight: 400 }}>{s.val}</div>
                  <div className="text-[11px] mt-1 leading-tight" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 140 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHY NAUTIUM */}
      <section id="difference" className="n-section-light py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
                {t.difference.badge}
              </p>
              <h2 className="n-serif n-gold-line mb-6" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#0B1A2E' }}>
                {t.difference.title}
              </h2>
              <p className="leading-relaxed mt-10" style={{ color: '#64748B', fontSize: 15 }}>
                {t.difference.sub}
              </p>
            </div>
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {t.difference.points.map((pt, i) => {
                const Icon = DIFF_ICONS[pt.icon];
                return (
                  <div
                    key={i}
                    className="p-6 transition-all duration-200"
                    style={{
                      background: pt.highlight ? '#0B1A2E' : '#fff',
                      color: pt.highlight ? '#E2E8F0' : '#1E293B',
                      border: pt.highlight ? 'none' : '1px solid rgba(0,0,0,0.06)',
                      borderRadius: 6,
                    }}
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center mb-4"
                      style={{
                        background: pt.highlight ? 'rgba(184,150,90,0.15)' : '#F6F4EE',
                        borderRadius: 6,
                      }}
                    >
                      {Icon && <Icon size={18} style={{ color: pt.highlight ? '#B8965A' : '#1A5F7A' }} />}
                    </div>
                    <h3 className="font-semibold text-[15px] mb-2">{pt.title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: pt.highlight ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>
                      {pt.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="n-section-dark py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
              {t.features.badge}
            </p>
            <h2 className="n-serif n-gold-line n-gold-line-center mb-5" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#fff', display: 'inline-block' }}>
              {t.features.title}
            </h2>
            <p className="mt-10 mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, maxWidth: 560 }}>
              {t.features.sub}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
            {t.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div
                  key={i}
                  className="p-7 transition-colors duration-200 group"
                  style={{ background: '#0B1A2E' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0F2137')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#0B1A2E')}
                >
                  <Icon size={20} className="mb-5" style={{ color: '#B8965A' }} />
                  <h3 className="font-semibold text-sm mb-2" style={{ color: '#E2E8F0' }}>{f.title}</h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COST OVERVIEW */}
      <section className="n-section-light py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
                {t.costs.badge}
              </p>
              <h2 className="n-serif n-gold-line mb-6" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#0B1A2E' }}>
                {t.costs.title}
              </h2>
              <p className="leading-relaxed mt-10 mb-10" style={{ color: '#64748B', fontSize: 15 }}>
                {t.costs.sub}
              </p>

              <div className="space-y-5">
                {t.costs.points.map((pt, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center" style={{ borderRadius: 3, border: '1.5px solid #B8965A' }}>
                      <Check size={11} style={{ color: '#B8965A' }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-0.5" style={{ color: '#0B1A2E' }}>{pt.title}</p>
                      <p className="text-[13px] leading-relaxed" style={{ color: '#94A3B8' }}>{pt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <button onClick={openDemo} className="n-btn-primary flex items-center gap-2.5" style={{ borderRadius: 4 }}>
                  {t.costs.cta}<ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="p-8" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-semibold text-base" style={{ color: '#0B1A2E' }}>Cost Overview</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Azure Dream — Last 3 months</p>
                </div>
                <div className="flex gap-1 p-1" style={{ background: '#F6F4EE', borderRadius: 4 }}>
                  <div className="px-3 py-1.5 text-xs font-semibold" style={{ background: '#0B1A2E', color: '#fff', borderRadius: 3 }}>{t.costs.tab1}</div>
                  <div className="px-3 py-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>{t.costs.tab2}</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Fuel', amount: '€21,045', color: '#D97706' },
                  { label: 'Parts', amount: '€879', color: '#1A5F7A' },
                  { label: 'Service', amount: '$3,250', color: '#B8965A' },
                  { label: 'Ops', amount: '€24,785', color: '#059669' },
                ].map((c, i) => (
                  <div key={i} className="p-3" style={{ background: '#F6F4EE', borderRadius: 4 }}>
                    <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: '#94A3B8' }}>{c.label}</p>
                    <p className="font-bold text-sm" style={{ color: c.color }}>{c.amount}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 mb-5 flex items-center justify-between" style={{ background: '#0B1A2E', borderRadius: 4 }}>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Period Cost</p>
                  <p className="font-bold text-xl" style={{ color: '#fff' }}>$49,959</p>
                </div>
                <TrendingDown size={24} style={{ color: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="space-y-0">
                {[
                  { icon: Fuel, label: 'Diesel Main Engines', sub: '12,000 L — Monaco', amount: '€11,040', color: '#D97706' },
                  { icon: Package, label: 'MTU Engine Oil 15W-40', sub: '45 units — Engine Oil Change', amount: '€562', color: '#1A5F7A' },
                  { icon: Wrench, label: 'Bow Thruster Service', sub: 'Servogear technician', amount: '$2,400', color: '#B8965A' },
                  { icon: DollarSign, label: 'Hull & Machinery Insurance', sub: 'Lloyds quarterly premium', amount: '$18,500', color: '#059669' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: i < 3 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <row.icon size={14} style={{ color: row.color, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#1E293B' }}>{row.label}</p>
                      <p className="text-[11px] truncate" style={{ color: '#94A3B8' }}>{row.sub}</p>
                    </div>
                    <p className="text-xs font-bold flex-shrink-0" style={{ color: row.color }}>{row.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-28" style={{ background: '#fff' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
              {t.howItWorks.badge}
            </p>
            <h2 className="n-serif" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#0B1A2E' }}>
              {t.howItWorks.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-4 left-[18%] right-[18%] h-px" style={{ background: 'rgba(184,150,90,0.25)' }} />
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-9 h-9 flex items-center justify-center flex-shrink-0 n-serif text-lg"
                    style={{ background: '#0B1A2E', color: '#B8965A', borderRadius: 4 }}
                  >
                    {step.num}
                  </div>
                  <div className="h-px flex-1" style={{ background: 'rgba(0,0,0,0.06)' }} />
                </div>
                <h3 className="font-semibold text-base mb-3" style={{ color: '#0B1A2E' }}>{step.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: '#94A3B8' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="for-who" className="n-section-dark py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
              {t.forWho.badge}
            </p>
            <h2 className="n-serif" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#fff' }}>
              {t.forWho.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.forWho.profiles.map((p, i) => (
              <div key={i} className="overflow-hidden group" style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="h-56 overflow-hidden relative">
                  <img
                    loading="lazy"
                    src={PHOTOS.profiles[i]}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ filter: 'brightness(0.7)' }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0B1A2E 100%)' }} />
                </div>
                <div className="p-7 -mt-8 relative" style={{ background: '#0B1A2E' }}>
                  <div className="w-8 h-0.5 mb-4" style={{ background: '#B8965A' }} />
                  <h3 className="font-semibold text-base mb-3" style={{ color: '#E2E8F0' }}>{p.title}</h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NAUTIUS AI */}
      <section id="nautius" className="n-section-light py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#B8965A' }}>
                {lang === 'en' ? 'AI-powered diagnostics' : 'Diagnóstico con IA'}
              </p>
              <h2 className="n-serif n-gold-line mb-6" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#0B1A2E' }}>
                {lang === 'en' ? 'Meet Nautius.' : 'Conoce a Nautius.'}
                <br />
                <span style={{ fontStyle: 'italic', color: '#1A5F7A' }}>
                  {lang === 'en' ? 'Your AI engineer, always on board.' : 'Tu ingeniero de IA, siempre a bordo.'}
                </span>
              </h2>
              <p className="leading-relaxed mt-10 mb-8" style={{ color: '#64748B', fontSize: 15 }}>
                {lang === 'en'
                  ? "Nautius reads your vessel's technical manuals and answers questions about faults, procedures, and diagnostics — in seconds, in English or Spanish."
                  : 'Nautius lee los manuales técnicos de tu embarcación y responde preguntas sobre averías, procedimientos y diagnósticos — en segundos, en español o inglés.'}
              </p>

              <div className="space-y-3">
                {(lang === 'en'
                  ? ["Searches your vessel's actual manuals", 'Answers in English & Spanish', 'Available 24/7, anywhere at sea', 'No hallucinations — grounded in your documents']
                  : ['Busca en los manuales reales de tu barco', 'Responde en español e inglés', 'Disponible 24/7, en cualquier océano', 'Sin alucinaciones — basado en tus documentos']
                ).map((chip, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} style={{ color: '#1A5F7A', flexShrink: 0 }} />
                    <span className="text-[13px] font-medium" style={{ color: '#64748B' }}>{chip}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: '#0B1A2E', borderRadius: 4 }}>
                    <span className="text-xs font-bold" style={{ color: '#B8965A' }}>N</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#0B1A2E' }}>Nautius</p>
                    <p className="text-[11px] font-medium" style={{ color: '#059669' }}>
                      {lang === 'en' ? 'Reading M/Y Azure Dream manuals' : 'Leyendo manuales del M/Y Azure Dream'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 flex-shrink-0" style={{ background: '#F6F4EE', borderRadius: 3, fontSize: 11 }}>
                    <BookOpen size={11} style={{ color: '#1A5F7A' }} />
                    <span className="font-semibold" style={{ color: '#1A5F7A' }}>
                      {lang === 'en' ? '3 manuals indexed' : '3 manuales indexados'}
                    </span>
                  </div>
                </div>

                <div className="px-6 py-6 space-y-4">
                  {nautiusDemo.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'nautius' && (
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-1" style={{ background: '#0B1A2E', borderRadius: 3 }}>
                          <span className="text-[9px] font-bold" style={{ color: '#B8965A' }}>N</span>
                        </div>
                      )}
                      <div
                        className="max-w-[80%] px-4 py-3"
                        style={{
                          background: msg.role === 'user' ? '#0B1A2E' : '#F6F4EE',
                          color: msg.role === 'user' ? '#E2E8F0' : '#1E293B',
                          borderRadius: msg.role === 'user' ? '6px 6px 2px 6px' : '6px 6px 6px 2px',
                        }}
                      >
                        <p className="text-[13px] leading-relaxed whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#F6F4EE', borderRadius: 4 }}>
                    <p className="flex-1 text-sm" style={{ color: '#94A3B8' }}>
                      {lang === 'en' ? 'Ask Nautius about any system on your vessel...' : 'Pregunta a Nautius sobre cualquier sistema de tu barco...'}
                    </p>
                    <button onClick={openDemo} className="n-btn-primary text-xs flex-shrink-0" style={{ padding: '8px 16px', borderRadius: 4 }}>
                      {lang === 'en' ? 'Request demo' : 'Solicitar demo'}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs mt-4" style={{ color: '#94A3B8' }}>
                {lang === 'en' ? "Nautius only answers based on your vessel's uploaded manuals — not generic internet results." : 'Nautius solo responde con los manuales subidos de tu embarcación — sin respuestas genéricas de internet.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="py-16" style={{ background: '#fff', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-[11px] uppercase tracking-[0.2em] mb-10 font-semibold" style={{ color: '#94A3B8' }}>{t.trust.label}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {t.trust.items.map((item, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <div key={i} className="flex flex-col items-center text-center gap-3">
                  <div className="w-11 h-11 flex items-center justify-center" style={{ background: '#F6F4EE', borderRadius: 4 }}>
                    <Icon size={18} style={{ color: '#1A5F7A' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#0B1A2E' }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="n-section-dark py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-12 h-0.5 mx-auto mb-8" style={{ background: '#B8965A' }} />
          <h2 className="n-serif mb-5" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.15, fontWeight: 400, color: '#fff' }}>
            {t.cta.title}
          </h2>
          <p className="mb-10 mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, maxWidth: 520 }}>
            {t.cta.sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={openDemo} className="n-btn-primary flex items-center justify-center gap-2.5" style={{ borderRadius: 4 }}>
              {t.cta.btn}<ArrowRight size={15} />
            </button>
            <button onClick={onEnterApp} className="n-btn-outline n-btn-outline-light" style={{ borderRadius: 4 }}>
              {t.cta.btnSecondary}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-14" style={{ background: '#081422', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div style={{ maxWidth: 300 }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 flex items-center justify-center" style={{ background: '#1A5F7A', borderRadius: 4 }}>
                  <Anchor size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-base font-bold" style={{ color: '#E2E8F0' }}>Nautium</span>
              </div>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.footer.desc}</p>
              <button
                onClick={toggleLang}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 }}
              >
                <Globe size={12} />{lang === 'en' ? 'Español' : 'English'}
              </button>
            </div>

            <div className="flex gap-16">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>{t.footer.platform}</p>
                <ul className="flex flex-col gap-3">
                  {t.footer.links.map(([label, href]) => (
                    <li key={href}>
                      <button onClick={() => scrollTo(href)} className="text-[13px] font-medium transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>{t.footer.account}</p>
                <ul className="flex flex-col gap-3">
                  <li><button onClick={onEnterApp} className="text-[13px] font-medium transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.footer.signIn}</button></li>
                  <li><button onClick={openDemo} className="text-[13px] font-medium transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.footer.requestDemo}</button></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>&copy; {new Date().getFullYear()} Nautium. {t.footer.rights}</p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <MapPin size={10} />
              <span>Monaco — Fort Lauderdale — Palma de Mallorca</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
