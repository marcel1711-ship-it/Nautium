import React, { useState } from 'react';
import {
  X, ChevronRight, ChevronLeft, Ship, Wrench, Package,
  Users, ClipboardList, ShieldCheck, FileText, BarChart3,
  Fuel, DollarSign, Anchor, CheckCircle2, Rocket,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface WelcomeGuideProps {
  onClose: () => void;
  onNavigate: (page: string) => void;
  userRole: string;
  userName?: string;
}

interface Step {
  icon: React.ElementType;
  titleEn: string;
  titleEs: string;
  descEn: string;
  descEs: string;
  page: string;
  color: string;
  order: number;
}

const FM_STEPS: Step[] = [
  {
    icon: Ship,
    titleEn: 'Fleet Overview',
    titleEs: 'Vista de Flota',
    descEn: 'See all your vessels at a glance — status, alerts, and key metrics across the entire fleet.',
    descEs: 'Ve todos tus barcos de un vistazo — estado, alertas y métricas clave de toda la flota.',
    page: 'fleet-overview',
    color: '#3b82f6',
    order: 1,
  },
  {
    icon: Wrench,
    titleEn: 'Equipment',
    titleEs: 'Equipos',
    descEn: 'Register all onboard equipment — engines, generators, watermakers, HVAC. This is the foundation for maintenance and inventory.',
    descEs: 'Registra todos los equipos a bordo — motores, generadores, watermakers, HVAC. Es la base para mantenimiento e inventario.',
    page: 'equipment',
    color: '#8b5cf6',
    order: 2,
  },
  {
    icon: ClipboardList,
    titleEn: 'Maintenance',
    titleEs: 'Mantenimiento',
    descEn: 'Create and schedule maintenance tasks for each equipment. Set intervals, assign crew, and track completion.',
    descEs: 'Crea y programa tareas de mantenimiento para cada equipo. Define intervalos, asigna tripulación y registra ejecución.',
    page: 'maintenance',
    color: '#f59e0b',
    order: 3,
  },
  {
    icon: Package,
    titleEn: 'Inventory',
    titleEs: 'Inventario',
    descEn: 'Track spare parts, consumables, and supplies. Get alerts when stock is low so you never run out at sea.',
    descEs: 'Controla repuestos, consumibles y suministros. Recibe alertas cuando el stock esté bajo para no quedarte sin nada en el mar.',
    page: 'inventory',
    color: '#10b981',
    order: 4,
  },
  {
    icon: Users,
    titleEn: 'Crew Management',
    titleEs: 'Gestión de Tripulación',
    descEn: 'Manage your crew — positions, departments, embarkation dates, contracts, and contact information.',
    descEs: 'Gestiona tu tripulación — posiciones, departamentos, fechas de embarque, contratos e información de contacto.',
    page: 'crew',
    color: '#06b6d4',
    order: 5,
  },
  {
    icon: ShieldCheck,
    titleEn: 'Compliance',
    titleEs: 'Cumplimiento',
    descEn: 'Track certificates, surveys, and regulatory deadlines. Never miss a renewal or flag state inspection.',
    descEs: 'Controla certificados, inspecciones y fechas regulatorias. Nunca pierdas una renovación o inspección de bandera.',
    page: 'compliance',
    color: '#ef4444',
    order: 6,
  },
  {
    icon: FileText,
    titleEn: 'Procurement',
    titleEs: 'Compras',
    descEn: 'Handle purchase requests and orders. Crew submits PRs, captains approve, you have full visibility and control.',
    descEs: 'Gestiona solicitudes de compra y órdenes. La tripulación envía PRs, el capitán aprueba, tú tienes visibilidad y control total.',
    page: 'procurement',
    color: '#ec4899',
    order: 7,
  },
  {
    icon: Fuel,
    titleEn: 'Fuel & Consumables',
    titleEs: 'Combustible y Consumibles',
    descEn: 'Log fuel bunkering, monitor consumption, and track costs across all vessels.',
    descEs: 'Registra repostajes, monitorea consumo y controla costos de combustible en todos los barcos.',
    page: 'fuel',
    color: '#f97316',
    order: 8,
  },
  {
    icon: DollarSign,
    titleEn: 'Financials & Budget',
    titleEs: 'Finanzas y Presupuesto',
    descEn: 'View cost breakdowns, set budgets per vessel, and generate reports for owners.',
    descEs: 'Ve desglose de costos, define presupuestos por barco y genera reportes para propietarios.',
    page: 'financials',
    color: '#14b8a6',
    order: 9,
  },
];

const CAPTAIN_STEPS: Step[] = [
  FM_STEPS[1], // Equipment
  FM_STEPS[2], // Maintenance
  FM_STEPS[3], // Inventory
  FM_STEPS[4], // Crew
  FM_STEPS[5], // Compliance
  FM_STEPS[6], // Procurement
  FM_STEPS[7], // Fuel
];

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose, onNavigate, userRole, userName }) => {
  const { language } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const isEs = language === 'es';

  const steps = userRole === 'captain' ? CAPTAIN_STEPS : FM_STEPS;
  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  const handleGoTo = () => {
    onClose();
    onNavigate(step.page);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
        animation: 'fadeInScale 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${step.color}, ${step.color}dd)`,
          padding: '32px 28px 28px', color: '#fff', position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={16} />
          </button>

          {currentStep === 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Anchor size={20} />
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Nautium</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                {isEs
                  ? `¡Bienvenido${userName ? `, ${userName.split(' ')[0]}` : ''}! 🎯`
                  : `Welcome${userName ? `, ${userName.split(' ')[0]}` : ''}! 🎯`}
              </h2>
              <p style={{ fontSize: 14, margin: '8px 0 0', opacity: 0.9, lineHeight: 1.5 }}>
                {isEs
                  ? 'Te guiaremos paso a paso por las secciones clave de tu plataforma.'
                  : "Let's walk you through the key sections of your platform."}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: currentStep === 0 ? 8 : 0 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={26} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
                {isEs ? `Paso ${currentStep + 1} de ${steps.length}` : `Step ${currentStep + 1} of ${steps.length}`}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>
                {isEs ? step.titleEs : step.titleEn}
              </h3>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, margin: 0 }}>
            {isEs ? step.descEs : step.descEn}
          </p>

          <button onClick={handleGoTo} style={{
            marginTop: 16, display: 'flex', alignItems: 'center', gap: 8,
            background: `${step.color}12`, border: `1px solid ${step.color}30`,
            borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
            color: step.color, fontSize: 14, fontWeight: 600, width: '100%',
            justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Icon size={16} />
            {isEs ? `Ir a ${step.titleEs}` : `Go to ${step.titleEn}`}
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0 28px 8px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= currentStep ? step.color : '#e2e8f0',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: '10px 18px', cursor: currentStep === 0 ? 'default' : 'pointer',
              color: currentStep === 0 ? '#cbd5e1' : '#475569',
              fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
            }}
          >
            <ChevronLeft size={16} />
            {isEs ? 'Anterior' : 'Back'}
          </button>

          {isLast ? (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: step.color, border: 'none', borderRadius: 10,
              padding: '10px 24px', cursor: 'pointer', color: '#fff',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
            }}>
              <Rocket size={16} />
              {isEs ? '¡Empezar!' : "Let's Go!"}
            </button>
          ) : (
            <button onClick={() => setCurrentStep(currentStep + 1)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: step.color, border: 'none', borderRadius: 10,
              padding: '10px 24px', cursor: 'pointer', color: '#fff',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
            }}>
              {isEs ? 'Siguiente' : 'Next'}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
