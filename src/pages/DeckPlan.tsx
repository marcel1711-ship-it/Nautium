import React, { useState, useEffect, useMemo } from 'react';
import {
  Map, Loader2, Ship, Wrench, Boxes, AlertCircle,
  ChevronDown, ChevronUp, X, FileText, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, fetchByCompany } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';

interface DeckPlanProps {
  onNavigate: (page: string, params?: any) => void;
}

interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  department: string;
  location_on_vessel: string;
  status: string;
  manufacturer?: string;
  model?: string;
  image_url?: string;
}

interface PlanDoc {
  id: string;
  title: string;
  file_url: string;
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const DEPT_COLORS: Record<string, { bg: string; fill: string; text: string; border: string }> = {
  Engineering: { bg: 'bg-orange-100', fill: '#ea580c', text: 'text-orange-700', border: 'border-orange-200' },
  Deck:        { bg: 'bg-blue-100',   fill: '#2563eb', text: 'text-blue-700',   border: 'border-blue-200' },
  Interior:    { bg: 'bg-purple-100', fill: '#7c3aed', text: 'text-purple-700', border: 'border-purple-200' },
  Galley:      { bg: 'bg-green-100',  fill: '#16a34a', text: 'text-green-700',  border: 'border-green-200' },
  Safety:      { bg: 'bg-red-100',    fill: '#dc2626', text: 'text-red-700',    border: 'border-red-200' },
  Navigation:  { bg: 'bg-indigo-100', fill: '#4f46e5', text: 'text-indigo-700', border: 'border-indigo-200' },
};

const DEFAULT_DEPT = { bg: 'bg-gray-100', fill: '#6b7280', text: 'text-gray-700', border: 'border-gray-200' };

// Deck definitions for a ~34m motor yacht
const DECKS = [
  { id: 'sun',    label: 'Sun Deck',    labelEs: 'Cubierta Sol' },
  { id: 'main',   label: 'Main Deck',   labelEs: 'Cubierta Principal' },
  { id: 'lower',  label: 'Lower Deck',  labelEs: 'Cubierta Inferior' },
  { id: 'engine', label: 'Engine Room',  labelEs: 'Sala de Máquinas' },
];

// Map equipment location strings to deck IDs
const locationToDeck = (loc: string): string => {
  const l = (loc || '').toLowerCase();
  if (l.includes('engine') || l.includes('motor') || l.includes('máquina')) return 'engine';
  if (l.includes('sun') || l.includes('fly') || l.includes('bridge') || l.includes('sol')) return 'sun';
  if (l.includes('lower') || l.includes('cabin') || l.includes('inferior') || l.includes('crew')) return 'lower';
  return 'main';
};

// Generate consistent pin positions per deck to avoid overlap
const getPinPosition = (index: number, total: number, deckId: string): { x: number; y: number } => {
  const cols = Math.min(total, 4);
  const row = Math.floor(index / cols);
  const col = index % cols;

  const startX = deckId === 'engine' ? 180 : 120;
  const spacingX = deckId === 'engine' ? 140 : 160;
  const startY = 55;
  const spacingY = 50;

  return { x: startX + col * spacingX, y: startY + row * spacingY };
};

// SVG yacht outline for each deck
const YachtOutline: React.FC<{ deckId: string; width: number; height: number }> = ({ deckId, width, height }) => {
  const hw = width / 2;
  const bowTaper = deckId === 'engine' ? 60 : 80;
  const sternCurve = 15;
  const margin = 10;
  const top = margin;
  const bottom = height - margin;
  const left = margin;
  const right = width - margin;

  // Simplified yacht hull shape — bow on the right
  const path = `
    M ${left + sternCurve} ${top}
    L ${right - bowTaper} ${top}
    Q ${right} ${top} ${right} ${hw > 0 ? (top + bottom) / 2 : bottom}
    Q ${right} ${bottom} ${right - bowTaper} ${bottom}
    L ${left + sternCurve} ${bottom}
    Q ${left} ${bottom} ${left} ${bottom - sternCurve}
    L ${left} ${top + sternCurve}
    Q ${left} ${top} ${left + sternCurve} ${top}
    Z
  `;

  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-gray-300"
    />
  );
};

// Equipment pin on the deck
const EquipmentPin: React.FC<{
  eq: EquipmentItem;
  x: number;
  y: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ eq, x, y, isSelected, onClick }) => {
  const dept = DEPT_COLORS[eq.department] || DEFAULT_DEPT;
  const r = isSelected ? 16 : 12;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Pulse animation for selected */}
      {isSelected && (
        <circle cx={x} cy={y} r={r + 6} fill={dept.fill} opacity={0.15}>
          <animate attributeName="r" from={String(r + 2)} to={String(r + 10)} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.2" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Pin circle */}
      <circle
        cx={x} cy={y} r={r}
        fill={isSelected ? dept.fill : 'white'}
        stroke={dept.fill}
        strokeWidth={isSelected ? 3 : 2}
      />
      {/* Icon placeholder — wrench */}
      <text
        x={x} y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isSelected ? 12 : 10}
        fill={isSelected ? 'white' : dept.fill}
        fontWeight="bold"
      >
        ⚙
      </text>
      {/* Label */}
      <text
        x={x} y={y + r + 14}
        textAnchor="middle"
        fontSize="9"
        fill="#374151"
        fontWeight="500"
      >
        {eq.name.length > 22 ? eq.name.substring(0, 20) + '…' : eq.name}
      </text>
    </g>
  );
};

export const DeckPlan: React.FC<DeckPlanProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState('main');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  const vesselId = selectedVesselId === 'all' ? null : selectedVesselId;
  const isEs = t('nav.dashboard') === 'Panel';

  useEffect(() => {
    loadData();
  }, [currentUser, vesselId]);

  const loadData = async () => {
    if (!currentUser || isDemoUser(currentUser.email)) { setLoading(false); return; }
    setLoading(true);
    try {
      const cid = currentUser.company_id;
      if (!cid) { setLoading(false); return; }

      const [equipmentData, manualsData] = await Promise.all([
        fetchByCompany('equipment', cid, 'name', true),
        fetchByCompany('maintenance_manuals', cid, 'title', true),
      ]);

      const filteredEq = vesselId
        ? equipmentData.filter((e: any) => e.vessel_id === vesselId)
        : equipmentData;
      setEquipment(filteredEq);

      const filteredPlans = (manualsData as any[])
        .filter((m: any) => m.category === 'Plans & Drawings' && (!vesselId || m.vessel_id === vesselId));
      setPlans(filteredPlans);
    } catch {
      showToast('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group equipment by deck
  const eqByDeck = useMemo(() => {
    const map: Record<string, EquipmentItem[]> = { sun: [], main: [], lower: [], engine: [] };
    equipment.forEach(eq => {
      const deck = locationToDeck(eq.location_on_vessel);
      if (map[deck]) map[deck].push(eq);
      else map.main.push(eq);
    });
    return map;
  }, [equipment]);

  const currentDeckEquipment = eqByDeck[selectedDeck] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!vesselId) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 rounded-xl"><Map className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEs ? 'Planos' : 'Deck Plans'}</h1>
            <p className="text-sm text-gray-500">{isEs ? 'Planos interactivos y ubicación de equipos' : 'Interactive vessel plans and equipment locations'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Ship className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{isEs ? 'Selecciona un Barco' : 'Select a Vessel'}</h3>
          <p className="text-gray-500">{isEs ? 'Elige un barco del dropdown del header.' : 'Choose a vessel from the header dropdown.'}</p>
        </div>
      </div>
    );
  }

  const svgWidth = 750;
  const svgHeight = selectedDeck === 'engine' ? 160 : 180;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl"><Map className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEs ? 'Planos' : 'Deck Plans'}</h1>
            <p className="text-sm text-gray-500">
              {equipment.length} {isEs ? 'equipos' : 'equipment'} · {DECKS.length} {isEs ? 'cubiertas' : 'decks'}
            </p>
          </div>
        </div>

        {plans.length > 0 && (
          <button
            onClick={() => setShowPlans(!showPlans)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {isEs ? 'Ver Planos PDF' : 'View PDF Plans'} ({plans.length})
            {showPlans ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* PDF Plans dropdown */}
      {showPlans && plans.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {plans.map(plan => (
              <a
                key={plan.id}
                href={plan.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors text-sm text-gray-700 hover:text-blue-700"
              >
                <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">{plan.title}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-300 ml-auto" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Deck tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {DECKS.map(deck => {
          const count = (eqByDeck[deck.id] || []).length;
          return (
            <button
              key={deck.id}
              onClick={() => { setSelectedDeck(deck.id); setSelectedEquipment(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                selectedDeck === deck.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isEs ? deck.labelEs : deck.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedDeck === deck.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Interactive Deck View */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Deck label */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {isEs
                  ? DECKS.find(d => d.id === selectedDeck)?.labelEs
                  : DECKS.find(d => d.id === selectedDeck)?.label
                }
              </h3>
              <span className="text-xs text-gray-400">
                {currentDeckEquipment.length} {isEs ? 'equipos' : 'items'}
              </span>
            </div>

            {/* SVG Deck plan */}
            <div className="p-4 bg-gradient-to-b from-sky-50/50 to-white overflow-x-auto">
              {currentDeckEquipment.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Boxes className="w-10 h-10 mb-2" />
                  <p className="text-sm">{isEs ? 'Sin equipos en esta cubierta' : 'No equipment on this deck'}</p>
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight + 30}`}
                  className="w-full"
                  style={{ minWidth: 500 }}
                >
                  {/* Yacht outline */}
                  <YachtOutline deckId={selectedDeck} width={svgWidth} height={svgHeight} />

                  {/* Deck label inside hull */}
                  <text x={svgWidth / 2} y={20} textAnchor="middle" fontSize="11" fill="#9ca3af" fontWeight="600" letterSpacing="2" textTransform="uppercase">
                    {(isEs ? DECKS.find(d => d.id === selectedDeck)?.labelEs : DECKS.find(d => d.id === selectedDeck)?.label)?.toUpperCase()}
                  </text>

                  {/* Bow arrow */}
                  <g transform={`translate(${svgWidth - 30}, ${svgHeight / 2})`}>
                    <line x1={-10} y1={0} x2={10} y2={0} stroke="#d1d5db" strokeWidth="1.5" />
                    <polygon points="10,-4 18,0 10,4" fill="#d1d5db" />
                    <text x={0} y={-8} textAnchor="middle" fontSize="8" fill="#9ca3af">BOW</text>
                  </g>

                  {/* Equipment pins */}
                  {currentDeckEquipment.map((eq, idx) => {
                    const pos = getPinPosition(idx, currentDeckEquipment.length, selectedDeck);
                    return (
                      <EquipmentPin
                        key={eq.id}
                        eq={eq}
                        x={pos.x}
                        y={pos.y}
                        isSelected={selectedEquipment?.id === eq.id}
                        onClick={() => setSelectedEquipment(selectedEquipment?.id === eq.id ? null : eq)}
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Legend */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap gap-3">
              {Object.entries(DEPT_COLORS).map(([dept, colors]) => {
                const count = currentDeckEquipment.filter(eq => eq.department === dept).length;
                if (count === 0) return null;
                return (
                  <div key={dept} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.fill }} />
                    {dept} ({count})
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Equipment Detail / List Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          {/* Selected equipment detail */}
          {selectedEquipment && (
            <div className="bg-white rounded-2xl border border-gray-200 mb-4 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{selectedEquipment.name}</h3>
                <button onClick={() => setSelectedEquipment(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {selectedEquipment.image_url && (
                <img
                  src={selectedEquipment.image_url}
                  alt={selectedEquipment.name}
                  className="w-full h-36 object-cover"
                />
              )}

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">{isEs ? 'Tipo' : 'Type'}</p>
                    <p className="text-sm font-medium text-gray-900">{selectedEquipment.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{isEs ? 'Departamento' : 'Department'}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      (DEPT_COLORS[selectedEquipment.department] || DEFAULT_DEPT).bg
                    } ${(DEPT_COLORS[selectedEquipment.department] || DEFAULT_DEPT).text}`}>
                      {selectedEquipment.department}
                    </span>
                  </div>
                </div>

                {(selectedEquipment.manufacturer || selectedEquipment.model) && (
                  <div>
                    <p className="text-xs text-gray-400">{isEs ? 'Fabricante / Modelo' : 'Manufacturer / Model'}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[selectedEquipment.manufacturer, selectedEquipment.model].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                )}

                {selectedEquipment.location_on_vessel && (
                  <div>
                    <p className="text-xs text-gray-400">{isEs ? 'Ubicación' : 'Location'}</p>
                    <p className="text-sm text-gray-700">{selectedEquipment.location_on_vessel}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onNavigate('equipment', { equipmentId: selectedEquipment.id })}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    {isEs ? 'Ver Equipo' : 'View Equipment'}
                  </button>
                  <button
                    onClick={() => onNavigate('maintenance', { equipmentId: selectedEquipment.id })}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {isEs ? 'Tareas' : 'Tasks'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Equipment list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Boxes className="w-4 h-4 text-gray-400" />
                {isEs ? 'Equipos en esta Cubierta' : 'Equipment on this Deck'}
              </h3>
            </div>

            <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-50">
              {currentDeckEquipment.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  {isEs ? 'Sin equipos en esta cubierta' : 'No equipment on this deck'}
                </div>
              ) : (
                currentDeckEquipment.map(eq => {
                  const dept = DEPT_COLORS[eq.department] || DEFAULT_DEPT;
                  const isActive = selectedEquipment?.id === eq.id;
                  return (
                    <button
                      key={eq.id}
                      onClick={() => setSelectedEquipment(isActive ? null : eq)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dept.fill }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                          {eq.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {[eq.manufacturer, eq.model].filter(Boolean).join(' ') || eq.type}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
