import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, FileText, Loader2, Ship,
  Wrench, Boxes, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/UI/Toast';

interface DeckPlanProps {
  onNavigate: (page: string, params?: any) => void;
}

interface PlanDocument {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  category: string;
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
}

const isDemoUser = (email: string) => email === 'admin@yachtmaintenance.pro';

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-orange-100 text-orange-700 border-orange-200',
  Deck:        'bg-blue-100 text-blue-700 border-blue-200',
  Interior:    'bg-purple-100 text-purple-700 border-purple-200',
  Galley:      'bg-green-100 text-green-700 border-green-200',
  Safety:      'bg-red-100 text-red-700 border-red-200',
  Navigation:  'bg-indigo-100 text-indigo-700 border-indigo-200',
};

export const DeckPlan: React.FC<DeckPlanProps> = ({ onNavigate }) => {
  const { currentUser, selectedVesselId } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [plans, setPlans] = useState<PlanDocument[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const vesselId = selectedVesselId === 'all' ? null : selectedVesselId;

  useEffect(() => {
    loadData();
  }, [currentUser, vesselId]);

  const loadData = async () => {
    if (!currentUser || isDemoUser(currentUser.email)) { setLoading(false); return; }
    setLoading(true);
    try {
      // Load plans & drawings
      let planQuery = supabase
        .from('maintenance_manuals')
        .select('id, title, description, file_url, file_name, category')
        .eq('company_id', currentUser.company_id)
        .eq('category', 'Plans & Drawings')
        .order('title');

      if (vesselId) planQuery = planQuery.eq('vessel_id', vesselId);

      const { data: planData } = await planQuery;
      if (planData) setPlans(planData);

      // Load equipment for the sidebar
      let eqQuery = supabase
        .from('equipment')
        .select('id, name, type, department, location_on_vessel, status, manufacturer, model')
        .eq('company_id', currentUser.company_id)
        .order('name');

      if (vesselId) eqQuery = eqQuery.eq('vessel_id', vesselId);

      const { data: eqData } = await eqQuery;
      if (eqData) setEquipment(eqData);
    } catch {
      showToast('Error loading deck plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans[selectedPlanIdx];

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 4));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const toggleFullscreen = () => setIsFullscreen(f => !f);

  const prevPlan = () => {
    setSelectedPlanIdx(i => (i > 0 ? i - 1 : plans.length - 1));
    handleResetView();
  };
  const nextPlan = () => {
    setSelectedPlanIdx(i => (i < plans.length - 1 ? i + 1 : 0));
    handleResetView();
  };

  // Group equipment by location
  const eqByLocation = equipment.reduce((acc, eq) => {
    const loc = eq.location_on_vessel || 'Unknown';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(eq);
    return acc;
  }, {} as Record<string, EquipmentItem[]>);

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
          <div className="p-2.5 bg-blue-50 rounded-xl">
            <Map className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deck Plans</h1>
            <p className="text-sm text-gray-500">Interactive vessel plans and equipment locations</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Ship className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Vessel</h3>
          <p className="text-gray-500">Choose a vessel from the header dropdown to view its deck plans.</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 rounded-xl">
            <Map className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deck Plans</h1>
            <p className="text-sm text-gray-500">Interactive vessel plans and equipment locations</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Plans Uploaded</h3>
          <p className="text-gray-500 mb-4">Upload plans and drawings in the Documents section to see them here.</p>
          <button
            onClick={() => onNavigate('manuals')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Documents
          </button>
        </div>
      </div>
    );
  }

  const viewerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col'
    : 'flex flex-col lg:flex-row gap-4';

  return (
    <div className={`p-6 ${isFullscreen ? 'p-0' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Map className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deck Plans</h1>
              <p className="text-sm text-gray-500">
                {plans.length} plan{plans.length !== 1 ? 's' : ''} · {equipment.length} equipment
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={viewerClasses}>
        {/* Plan Viewer */}
        <div className={`${isFullscreen ? 'flex-1 flex flex-col' : 'flex-1'}`}>
          {/* Toolbar */}
          <div className={`flex items-center justify-between px-4 py-2.5 ${isFullscreen ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border border-gray-200 rounded-t-2xl'}`}>
            <div className="flex items-center gap-2">
              <button onClick={prevPlan} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`text-sm font-medium min-w-0 truncate max-w-[300px] ${isFullscreen ? 'text-white' : 'text-gray-900'}`}>
                {selectedPlan?.title}
              </span>
              <span className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-400'}`}>
                ({selectedPlanIdx + 1}/{plans.length})
              </span>
              <button onClick={nextPlan} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={handleZoomOut} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className={`text-xs font-mono w-12 text-center ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={handleZoomIn} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={handleResetView} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Reset view">
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className={`w-px h-5 mx-1 ${isFullscreen ? 'bg-gray-600' : 'bg-gray-200'}`} />
              <button onClick={toggleFullscreen} className={`p-1.5 rounded-lg transition-colors ${isFullscreen ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Plan Image */}
          <div
            ref={containerRef}
            className={`relative overflow-hidden select-none ${
              isFullscreen
                ? 'flex-1 bg-gray-900'
                : 'bg-gray-50 border border-t-0 border-gray-200 rounded-b-2xl'
            }`}
            style={{ height: isFullscreen ? undefined : '65vh', cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {selectedPlan?.file_url && (
              selectedPlan.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedPlan.file_url}
                  className="w-full h-full border-0"
                  title={selectedPlan.title}
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center',
                  }}
                />
              ) : (
                <img
                  ref={imgRef}
                  src={selectedPlan.file_url}
                  alt={selectedPlan.title}
                  className="max-w-none"
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: '-50%',
                    marginLeft: '-50%',
                  }}
                />
              )
            )}
          </div>

          {/* Plan thumbnails */}
          {plans.length > 1 && !isFullscreen && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {plans.map((plan, idx) => (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlanIdx(idx); handleResetView(); }}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    idx === selectedPlanIdx
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                  {plan.title.replace('DL34 ', '')}
                </button>
              ))}
            </div>
          )}

          {/* Plan description */}
          {selectedPlan?.description && !isFullscreen && (
            <p className="mt-2 text-xs text-gray-500 px-1">{selectedPlan.description}</p>
          )}
        </div>

        {/* Equipment Sidebar */}
        {!isFullscreen && (
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-gray-400" />
                  Equipment on Board
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{equipment.length} items</p>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {Object.entries(eqByLocation).length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">
                    No equipment found for this vessel.
                  </div>
                ) : (
                  Object.entries(eqByLocation).map(([location, items]) => (
                    <div key={location} className="border-b border-gray-50 last:border-0">
                      <div className="px-4 py-2 bg-gray-50">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {location}
                        </span>
                      </div>
                      {items.map(eq => (
                        <button
                          key={eq.id}
                          onClick={() => onNavigate('equipment', { equipmentId: eq.id })}
                          className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-blue-50/50 transition-colors text-left"
                        >
                          <div className={`mt-0.5 p-1 rounded-lg border ${DEPT_COLORS[eq.department] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            <Wrench className="w-3 h-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{eq.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {[eq.manufacturer, eq.model].filter(Boolean).join(' ') || eq.type}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
