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
  return (
    <div className="min-h-screen bg-[#05111e] text-white font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.07),transparent_70%)]" />
        <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(2,132,199,0.05),transparent_70%)]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(14,116,144,0.04),transparent_70%)]" />
      </div>
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#05111e]/95 backdrop-blur-2xl border-b border-white/[0.07] py-3 shadow-2xl shadow-black/40' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Anchor size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Nau<span className="text-cyan-400">tium</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm text-white/50 hover:text-white tracking-wide transition-colors duration-200 font-medium">{l.label}</button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={toggleLang} className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/80 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-full transition-all duration-200 mr-2">
              <Globe size={12} />{lang === 'en' ? 'ES' : 'EN'}
            </button>
            <button onClick={onEnterApp} className="text-sm text-white/50 hover:text-white px-4 py-2 transition-colors duration-200 font-medium">{t.nav.signIn}</button>
            <button onClick={openDemo} className="text-sm bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-px">
              {t.nav.requestDemo}
            </button>
          </div>
          <button className="md:hidden text-white/60 hover:text-white transition-colors" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-[#05111e]/98 backdrop-blur-2xl border-t border-white/[0.07] px-6 py-5 flex flex-col gap-4">
            {navLinks.map(l => <button key={l.href} onClick={() => scrollTo(l.href)} className="text-left text-white/50 hover:text-white py-1 text-sm tracking-wide transition-colors font-medium">{l.label}</button>)}
            <hr className="border-white/[0.08]" />
            <button onClick={toggleLang} className="flex items-center gap-2 text-white/40 hover:text-white text-sm py-1 transition-colors font-medium w-fit">
              <Globe size={14} />{lang === 'en' ? 'Español' : 'English'}
            </button>
            <button onClick={onEnterApp} className="text-left text-white/50 hover:text-white text-sm py-1 transition-colors font-medium">{t.nav.signIn}</button>
            <button onClick={openDemo} className="bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-semibold text-sm py-3 rounded-full shadow-lg shadow-cyan-500/25">{t.nav.requestDemo}</button>
          </div>
        )}
      </nav>
      {/* HERO */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.pexels.com/photos/5488927/pexels-photo-5488927.jpeg?auto=compress&cs=tinysrgb&w=1920)' }} />
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#05111e]/95 via-[#05111e]/70 to-[#05111e]/40" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#05111e]/60 via-transparent to-[#05111e]/90" />
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_50%_80%_at_15%_50%,rgba(14,116,144,0.18),transparent_70%)]" />
        <div className="relative z-[2] max-w-7xl mx-auto px-6 pt-32 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/30 rounded-full px-4 py-1.5 mb-3 backdrop-blur-sm">
              <Languages size={13} className="text-cyan-400" />
              <span className="text-xs tracking-wide text-cyan-300/90 font-semibold">{t.hero.bilingual}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => scrollTo('#nautius')} className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/15 to-sky-600/15 border border-cyan-400/40 hover:border-cyan-400/70 rounded-full px-4 py-1.5 backdrop-blur-sm transition-all duration-200 group">
                <Zap size={12} className="text-cyan-400" />
                <span className="text-xs tracking-wide text-cyan-300 font-semibold">{t.hero.nautiusBadge}</span>
                <ArrowRight size={11} className="text-cyan-400/60 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs tracking-[0.2em] uppercase text-white/50 font-semibold">{t.hero.badge}</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-[4.2rem] font-bold tracking-tight leading-[1.05] mb-6 text-white">
              {t.hero.h1a}<br />
              <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">{t.hero.h1b}</span>
            </h1>
            <p className="text-lg text-slate-300/60 leading-relaxed mb-10 max-w-xl">{t.hero.sub}</p>

            {/* Department pills */}
            <div className="flex flex-wrap gap-2 mb-10">
              {[
                { label: lang === 'en' ? 'Engineering' : 'Ingeniería', color: 'bg-orange-500/15 border-orange-500/30 text-orange-300' },
                { label: lang === 'en' ? 'Deck' : 'Cubierta', color: 'bg-blue-500/15 border-blue-500/30 text-blue-300' },
                { label: 'Interior', color: 'bg-purple-500/15 border-purple-500/30 text-purple-300' },
                { label: lang === 'en' ? 'Galley' : 'Cocina', color: 'bg-green-500/15 border-green-500/30 text-green-300' },
                { label: lang === 'en' ? 'Safety' : 'Seguridad', color: 'bg-red-500/15 border-red-500/30 text-red-300' },
              ].map(dept => (
                <span key={dept.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${dept.color}`}>{dept.label}</span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <button onClick={openDemo} className="group flex items-center gap-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-bold px-8 py-4 rounded-full text-sm tracking-wide transition-all duration-300 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/45 hover:-translate-y-0.5">
                {t.hero.cta}<ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => scrollTo('#how-it-works')} className="flex items-center gap-2 border border-white/15 hover:border-white/35 text-white/70 hover:text-white px-8 py-4 rounded-full text-sm tracking-wide transition-all duration-300 hover:bg-white/[0.06] backdrop-blur-sm font-medium">
                {t.hero.ctaSecondary}
              </button>
            </div>
            <div className="mt-14 flex items-center gap-10 border-t border-white/[0.08] pt-8">
              {t.stats.map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-cyan-400">{s.val}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-tight max-w-[130px]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex justify-end">
            <div className="relative w-[420px]">
              <div className="absolute inset-0 scale-110 bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,0.2),transparent_70%)]" />
              <div className="relative bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Fleet Overview</p>
                    <p className="text-white font-bold text-xl">M/Y Adriatica</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                    <Anchor size={18} className="text-cyan-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { icon: Wrench, label: 'Engineering', val: '3 pending', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { icon: Anchor, label: 'Deck', val: 'All good', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: Package, label: 'Interior', val: '98% stocked', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    { icon: Bell, label: 'Alerts', val: '1 overdue', color: 'text-rose-400', bg: 'bg-rose-500/10' },
                  ].map((item, i) => (
                    <div key={i} className={`${item.bg} rounded-2xl p-4 border border-white/[0.06]`}>
                      <item.icon size={16} className={`${item.color} mb-2`} />
                      <p className="text-white/40 text-[10px] uppercase tracking-wider">{item.label}</p>
                      <p className={`${item.color} font-semibold text-sm mt-0.5`}>{item.val}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[
                    { task: 'Engine oil change', dept: 'Engineering', urgent: true },
                    { task: 'Fender inspection', dept: 'Deck', urgent: false },
                    { task: 'Linen inventory check', dept: 'Interior', urgent: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${item.urgent ? 'bg-rose-400' : 'bg-slate-600'}`} />
                        <span className="text-white/70 text-xs font-medium">{item.task}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.urgent ? 'bg-rose-500/15 text-rose-400' : 'bg-white/5 text-white/30'}`}>{item.dept}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-6 -left-10 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-4 w-52 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Check size={14} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-xs">Task completed</p>
                    <p className="text-white/30 text-[10px]">Deck · Just now</p>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] leading-relaxed">Fender inspection logged. Deck inventory updated automatically.</p>
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => scrollTo('#difference')} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2] flex flex-col items-center gap-1.5 text-white/25 hover:text-white/60 transition-colors">
          <span className="text-[10px] tracking-[0.25em] uppercase font-medium">{t.scroll}</span>
          <ChevronDown size={16} className="animate-bounce" />
        </button>
      </section>
      {/* WHY NAUTIUM */}
      <section id="difference" className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-cyan-400/80 text-xs tracking-[0.25em] uppercase font-bold mb-4">{t.difference.badge}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">{t.difference.title}</h2>
            <p className="text-slate-400/60 max-w-2xl mx-auto text-lg leading-relaxed">{t.difference.sub}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {t.difference.points.map((pt, i) => {
              const Icon = DIFF_ICONS[pt.icon];
              return (
                <div key={i} className={`group relative rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-1 ${pt.highlight ? 'bg-cyan-500/[0.06] border-cyan-500/25 hover:border-cyan-400/40' : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15'}`}>
                  {pt.highlight && (
                    <div className="absolute top-4 right-4 bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
                      {lang === 'en' ? 'Unique' : 'Único'}
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${pt.highlight ? 'bg-cyan-500/15' : 'bg-white/[0.05]'}`}>
                    {Icon && <Icon size={22} className={pt.highlight ? 'text-cyan-400' : 'text-slate-400'} />}
                  </div>
                  <h3 className="text-white font-bold text-lg mb-3">{pt.title}</h3>
                  <p className="text-slate-400/60 text-sm leading-relaxed">{pt.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* FEATURES */}
      <section id="features" className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-cyan-400/80 text-xs tracking-[0.25em] uppercase font-bold mb-4">{t.features.badge}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">{t.features.title}</h2>
            <p className="text-slate-400/60 max-w-xl mx-auto text-lg leading-relaxed">{t.features.sub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={i} className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-cyan-500/30 rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-1 cursor-default">
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_left,rgba(14,116,144,0.08),transparent_60%)]" />
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 flex items-center justify-center mb-5 transition-colors">
                      <Icon size={20} className="text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold mb-2 text-sm">{f.title}</h3>
                    <p className="text-slate-400/50 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* COST OVERVIEW */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-cyan-400/80 text-xs tracking-[0.25em] uppercase font-bold mb-4">{t.costs.badge}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">{t.costs.title}</h2>
            <p className="text-slate-400/60 max-w-2xl mx-auto text-lg leading-relaxed">{t.costs.sub}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              {t.costs.points.map((pt, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-0.5 group-hover:bg-cyan-500/20 transition-colors">
                    <Check size={14} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">{pt.title}</p>
                    <p className="text-slate-400/50 text-sm leading-relaxed">{pt.desc}</p>
                  </div>
                </div>
              ))}
              <div className="pt-4">
                <button onClick={openDemo} className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-bold px-8 py-3.5 rounded-full text-sm transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5">
                  {t.costs.cta}<ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 scale-110 bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,0.15),transparent_70%)]" />
              <div className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.07]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-bold text-base">Cost Overview</p>
                      <p className="text-white/30 text-xs mt-0.5">Azure Dream · Last 3 months</p>
                    </div>
                    <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
                      <div className="px-3 py-1.5 rounded-lg bg-white/[0.1] text-white text-xs font-semibold">{t.costs.tab1}</div>
                      <div className="px-3 py-1.5 rounded-lg text-white/30 text-xs font-medium">{t.costs.tab2}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Fuel', amount: '€21,045', icon: Fuel, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                      { label: 'Parts', amount: '€879', icon: Package, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                      { label: 'Service', amount: '$3,250', icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                      { label: 'Operational', amount: '€24,785', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map((c, i) => (
                      <div key={i} className={`${c.bg} rounded-xl p-3 border border-white/[0.05]`}>
                        <c.icon size={13} className={`${c.color} mb-1.5`} />
                        <p className="text-white/30 text-[9px] uppercase tracking-wider leading-none mb-1">{c.label}</p>
                        <p className={`${c.color} font-bold text-xs`}>{c.amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mx-6 my-4 bg-gradient-to-r from-[#0a2540] to-[#0d3356] rounded-2xl px-5 py-4 flex items-center justify-between border border-cyan-500/10">
                  <div>
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">Total Period Cost</p>
                    <p className="text-white font-bold text-xl">$49,959</p>
                  </div>
                  <TrendingDown size={28} className="text-white/10" />
                </div>
                <div className="px-6 pb-6 space-y-1">
                  {[
                    { icon: Fuel, label: 'Diesel Main Engines', sub: '12,000 L · Monaco', amount: '€11,040', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { icon: Package, label: 'MTU Engine Oil 15W-40', sub: '45 units · Engine Oil Change', amount: '€562', color: 'text-sky-400', bg: 'bg-sky-500/10' },
                    { icon: Wrench, label: 'Bow Thruster Annual Service', sub: 'Servogear technician', amount: '$2,400', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { icon: DollarSign, label: 'Hull & Machinery Insurance', sub: 'Lloyds quarterly premium', amount: '$18,500', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className={`w-7 h-7 rounded-lg ${row.bg} flex items-center justify-center flex-shrink-0`}>
                        <row.icon size={12} className={row.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-xs font-medium truncate">{row.label}</p>
                        <p className="text-white/25 text-[10px] truncate">{row.sub}</p>
                      </div>
                      <p className={`text-xs font-bold flex-shrink-0 ${row.color}`}>{row.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-6 -right-4 bg-[#091d32]/90 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-4 w-52 shadow-xl">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <Boxes size={13} className="text-teal-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">Inventory Value</p>
                    <p className="text-white/30 text-[10px]">Current stock</p>
                  </div>
                </div>
                <p className="text-teal-300 font-bold text-lg">$7,842</p>
                <p className="text-white/25 text-[10px] mt-0.5">12 items with unit cost</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-16 justify-center">
            <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-cyan-500/30" />
            <p className="text-cyan-400/80 text-xs tracking-[0.25em] uppercase font-bold">{t.howItWorks.badge}</p>
            <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-cyan-500/30" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-20">{t.howItWorks.title}</h2>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="hidden md:block absolute top-14 left-[22%] right-[22%] h-px bg-gradient-to-r from-cyan-500/10 via-cyan-400/40 to-cyan-500/10" />
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative text-center group">
                <div className="relative inline-flex items-center justify-center mb-8">
                  <div className="w-28 h-28 rounded-full border border-cyan-500/20 absolute animate-pulse opacity-50" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0a2540] to-[#0d3356] border border-cyan-500/30 flex items-center justify-center shadow-xl shadow-black/30 group-hover:border-cyan-400/50 transition-all duration-300">
                    <span className="text-3xl font-bold bg-gradient-to-b from-cyan-300 to-sky-500 bg-clip-text text-transparent">{step.num}</span>
                  </div>
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-slate-400/50 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* WHO IT'S FOR */}
      <section id="for-who" className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-cyan-400/80 text-xs tracking-[0.25em] uppercase font-bold mb-4">{t.forWho.badge}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">{t.forWho.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {t.forWho.profiles.map((p, i) => (
              <div key={i} className="group relative overflow-hidden rounded-3xl border border-white/[0.08] hover:border-cyan-500/30 transition-all duration-500 hover:-translate-y-1 cursor-default">
                <div className="h-60 overflow-hidden relative">
                  <img loading="lazy" src={[
                    'https://images.pexels.com/photos/8886818/pexels-photo-8886818.jpeg?auto=compress&cs=tinysrgb&w=800',
                    'https://images.pexels.com/photos/15452603/pexels-photo-15452603.jpeg?auto=compress&cs=tinysrgb&w=800',
                    'https://images.pexels.com/photos/10642986/pexels-photo-10642986.jpeg?auto=compress&cs=tinysrgb&w=800',
                  ][i]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-75 group-hover:brightness-90" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-[#05111e]" />
                </div>
                <div className="relative bg-[#05111e] px-7 pb-7 -mt-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Anchor size={14} className="text-cyan-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg leading-tight">{p.title}</h3>
                  </div>
                  <p className="text-slate-400/55 text-sm leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* NAUTIUS */}
      <section id="nautius" className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/20 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs tracking-[0.2em] uppercase text-cyan-400/80 font-semibold">
                {lang === 'en' ? 'AI-powered diagnostics' : 'Diagnóstico con IA'}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {lang === 'en' ? 'Meet Nautius. ' : 'Conoce a Nautius. '}
              <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                {lang === 'en' ? 'Your AI engineer, always on board.' : 'Tu ingeniero de IA, siempre a bordo.'}
              </span>
            </h2>
            <p className="text-slate-400/60 max-w-2xl mx-auto text-lg leading-relaxed">
              {lang === 'en'
                ? "Nautius reads your vessel's technical manuals and answers questions about faults, procedures, and diagnostics — in seconds, in English or Spanish."
                : 'Nautius lee los manuales técnicos de tu embarcación y responde preguntas sobre averías, procedimientos y diagnósticos — en segundos, en español o inglés.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {(lang === 'en'
              ? ["Searches your vessel's actual manuals", 'Answers in English & Spanish', 'Available 24/7, anywhere at sea', 'No hallucinations — grounded in your documents']
              : ['Busca en los manuales reales de tu barco', 'Responde en español e inglés', 'Disponible 24/7, en cualquier océano', 'Sin alucinaciones — basado en tus documentos']
            ).map((chip, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-2">
                <Check size={13} className="text-cyan-400 flex-shrink-0" />
                <span className="text-white/60 text-xs font-medium">{chip}</span>
              </div>
            ))}
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/30 to-sky-600/30 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 font-bold text-xs">N</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Nautius</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-emerald-400/80 text-[10px] font-medium truncate">
                      {lang === 'en' ? 'Reading M/Y Azure Dream manuals' : 'Leyendo manuales del M/Y Azure Dream'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 flex-shrink-0">
                  <BookOpen size={11} className="text-cyan-400" />
                  <span className="text-cyan-400/80 text-[10px] font-semibold">
                    {lang === 'en' ? '3 manuals indexed' : '3 manuales indexados'}
                  </span>
                </div>
              </div>
              <div className="px-6 py-6 space-y-5">
                {nautiusDemo.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'nautius' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-sky-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-cyan-400 font-bold text-[10px]">N</span>
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-cyan-500/15 border border-cyan-500/20 rounded-tr-sm' : 'bg-white/[0.04] border border-white/[0.07] rounded-tl-sm'}`}>
                      <p className={`text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'text-cyan-100' : 'text-slate-300/80'}`}>{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3">
                  <p className="text-slate-600 text-sm flex-1">
                    {lang === 'en' ? 'Ask Nautius about any system on your vessel...' : 'Pregunta a Nautius sobre cualquier sistema de tu barco...'}
                  </p>
                  <button onClick={openDemo} className="bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex-shrink-0">
                    {lang === 'en' ? 'Request demo' : 'Solicitar demo'}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-slate-600 text-xs mt-6 leading-relaxed">
              {lang === 'en' ? "Nautius only answers based on your vessel's uploaded manuals — not generic internet results." : 'Nautius solo responde con los manuales subidos de tu embarcación — sin respuestas genéricas de internet.'}
            </p>
          </div>
        </div>
      </section>
      {/* TRUST STRIP */}
      <section className="relative z-10 py-16 border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-slate-600 text-xs uppercase tracking-[0.25em] mb-10 font-medium">{t.trust.label}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {t.trust.items.map((item, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <div key={i} className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <Icon size={20} className="text-cyan-400/70" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{item.label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* CTA BANNER */}
      <section className="relative z-10 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-[#091d32] to-[#05111e] p-12 md:p-16 text-center shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[radial-gradient(ellipse_at_top,rgba(14,116,144,0.2),transparent_70%)]" />
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-[radial-gradient(circle,rgba(2,132,199,0.08),transparent_70%)]" />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="h-px w-12 bg-cyan-500/30" />
                <Zap size={14} className="text-cyan-400" />
                <div className="h-px w-12 bg-cyan-500/30" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t.cta.title}</h2>
              <p className="text-slate-400/60 mb-10 text-lg max-w-2xl mx-auto leading-relaxed">{t.cta.sub}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={openDemo} className="group flex items-center justify-center gap-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-bold px-10 py-4 rounded-full text-sm tracking-wide transition-all duration-300 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/45 hover:-translate-y-0.5">
                  {t.cta.btn}<ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={onEnterApp} className="border border-white/15 hover:border-white/30 text-white/60 hover:text-white px-10 py-4 rounded-full text-sm tracking-wide transition-all duration-300 hover:bg-white/[0.05] font-medium">
                  {t.cta.btnSecondary}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06] py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-600 flex items-center justify-center shadow shadow-cyan-500/25">
                  <Anchor size={14} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-bold text-white">Nau<span className="text-cyan-400">tium</span></span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{t.footer.desc}</p>
              <button onClick={toggleLang} className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-300 border border-white/[0.07] hover:border-white/15 px-3 py-1.5 rounded-full transition-all duration-200">
                <Globe size={12} />{lang === 'en' ? 'Español' : 'English'}
              </button>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold">{t.footer.platform}</p>
                <ul className="flex flex-col gap-3">
                  {t.footer.links.map(([label, href]) => (
                    <li key={href}><button onClick={() => scrollTo(href)} className="text-slate-600 hover:text-white text-sm transition-colors font-medium">{label}</button></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em] mb-5 font-semibold">{t.footer.account}</p>
                <ul className="flex flex-col gap-3">
                  <li><button onClick={onEnterApp} className="text-slate-600 hover:text-white text-sm transition-colors font-medium">{t.footer.signIn}</button></li>
                  <li><button onClick={openDemo} className="text-slate-600 hover:text-white text-sm transition-colors font-medium">{t.footer.requestDemo}</button></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-slate-700 text-xs">&copy; {new Date().getFullYear()} Nautium. {t.footer.rights}</p>
            <div className="flex items-center gap-1 text-slate-700 text-xs">
              <MapPin size={10} />
              <span>Monaco · Fort Lauderdale · Palma de Mallorca</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
