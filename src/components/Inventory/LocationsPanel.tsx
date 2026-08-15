import React, { useState, useEffect, useRef } from 'react';
import { MapPin, QrCode, Download, Package, AlertTriangle, ChevronRight, Printer } from 'lucide-react';
import { InventoryItem } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { isLowStock } from '../../utils/helpers';
import { generateQRDataURL, generateLocationURL } from '../../utils/qrcode';

interface LocationGroup {
  location: string;
  items: InventoryItem[];
  lowCount: number;
}

interface LocationsPanelProps {
  items: InventoryItem[];
  onNavigate: (page: string, params?: any) => void;
  isDemo: boolean;
}

export const LocationsPanel: React.FC<LocationsPanelProps> = ({ items, onNavigate, isDemo }) => {
  const { t } = useLanguage();
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const locationGroups: LocationGroup[] = React.useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const loc = item.storage_location || 'No Location Set';
      if (!map.has(loc)) map.set(loc, []);
      map.get(loc)!.push(item);
    }
    return Array.from(map.entries())
      .map(([location, items]) => ({
        location,
        items,
        lowCount: items.filter(isLowStock).length,
      }))
      .sort((a, b) => a.location.localeCompare(b.location));
  }, [items]);

  const generateQR = async (location: string) => {
    if (qrImages[location]) return;
    const url = generateLocationURL(location);
    const dataUrl = await generateQRDataURL(url, 240);
    setQrImages(prev => ({ ...prev, [location]: dataUrl }));
  };

  const handleExpand = async (location: string) => {
    const next = expandedLocation === location ? null : location;
    setExpandedLocation(next);
    if (next) await generateQR(next);
  };

  const handleDownload = (location: string) => {
    const img = qrImages[location];
    if (!img) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = `qr-${location.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintAll = async () => {
    setGeneratingAll(true);

    // Generate all QRs first
    const toGenerate = locationGroups
      .filter(g => g.location !== 'No Location Set')
      .map(g => g.location);

    await Promise.all(toGenerate.map(loc => generateQR(loc)));
    setGeneratingAll(false);

    // Wait for state update
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (locationGroups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
        <MapPin className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">No locations defined yet</p>
        <p className="text-sm text-gray-500 mt-1">Add a Storage Location to inventory items to see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with print all */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t('inventory.storageLocations')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {locationGroups.length} locations • Scan a QR code to see all items at that location
          </p>
        </div>
        <button
          onClick={handlePrintAll}
          disabled={generatingAll}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 text-sm"
        >
          <Printer className="w-4 h-4" />
          {generatingAll ? 'Generating...' : 'Print All QR Codes'}
        </button>
      </div>

      {/* Location cards */}
      {locationGroups.map(group => {
        const isExpanded = expandedLocation === group.location;
        const qr = qrImages[group.location];
        const noLocation = group.location === 'No Location Set';

        return (
          <div
            key={group.location}
            className={`bg-white rounded-2xl border transition-all duration-200 ${
              isExpanded ? 'border-blue-300 shadow-lg shadow-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Location header — click to expand */}
            <button
              className="w-full text-left p-5 flex items-center gap-4"
              onClick={() => handleExpand(group.location)}
            >
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${noLocation ? 'bg-gray-100' : 'bg-blue-50'}`}>
                <MapPin className={`w-5 h-5 ${noLocation ? 'text-gray-400' : 'text-blue-600'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base truncate ${noLocation ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                  {group.location}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                  </span>
                  {group.lowCount > 0 && (
                    <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {group.lowCount} low stock
                    </span>
                  )}
                </div>
              </div>

              {!noLocation && (
                <QrCode className={`w-5 h-5 flex-shrink-0 transition-colors ${isExpanded ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
              <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-5">
                <div className="flex gap-6 flex-wrap">
                  {/* QR code */}
                  {!noLocation && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-white rounded-2xl border-2 border-gray-200 shadow-inner">
                        {qr ? (
                          <img src={qr} alt={`QR for ${group.location}`} className="w-44 h-44" />
                        ) : (
                          <div className="w-44 h-44 bg-gray-50 rounded-xl flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 text-center max-w-[10rem] leading-tight">
                        {t('inventory.scanToView')}
                      </p>
                      {qr && (
                        <button
                          onClick={() => handleDownload(group.location)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PNG
                        </button>
                      )}
                    </div>
                  )}

                  {/* Item list */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Items at this location</p>
                    <div className="space-y-2">
                      {group.items.map(item => {
                        const low = isLowStock(item);
                        return (
                          <button
                            key={item.id}
                            onClick={() => onNavigate('inventory-detail', { itemId: item.id })}
                            className="w-full flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.part_number} • {item.category}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-sm font-semibold ${low ? 'text-red-600' : 'text-gray-700'}`}>
                                {item.current_stock} {item.unit_of_measure}
                              </span>
                              {low && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {!noLocation && (
                      <button
                        onClick={() => onNavigate('location-view', { location: group.location })}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Open Location View
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Print-only section (hidden on screen) */}
      <div className="hidden print:block">
        <div className="print-qr-grid">
          {locationGroups
            .filter(g => g.location !== 'No Location Set' && qrImages[g.location])
            .map(group => (
              <div key={group.location} className="print-qr-card">
                <img src={qrImages[group.location]} alt={group.location} />
                <p className="print-location-name">{group.location}</p>
                <p className="print-item-count">{group.items.length} items</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
