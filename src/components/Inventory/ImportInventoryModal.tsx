import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { NewInventoryData } from './AddInventoryModal';

interface ImportInventoryModalProps {
  vessels: { id: string; name: string }[];
  equipment: { id: string; name: string; vessel_id: string }[];
  onClose: () => void;
  onImport: (items: NewInventoryData[]) => Promise<void>;
}

const CATEGORIES = [
  'Engine Parts', 'Electrical', 'Hydraulic', 'Fuel System', 'Cooling System',
  'Safety Equipment', 'Lubricants', 'Filters', 'Gaskets & Seals', 'Fasteners', 'Other',
];
const UNITS = ['pcs', 'liters', 'kg', 'meters', 'boxes', 'sets'];
const VALID_DEPARTMENTS = ['Engineering', 'Deck', 'Interior', 'Galley', 'Safety'];

interface ParsedRow {
  row: number;
  data: NewInventoryData;
  errors: string[];
  vesselName: string;
  equipmentName: string;
}

function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const SEP = lines[0].includes(';') ? ';' : ',';
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === SEP && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  };
  const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
    return obj;
  });
}

function generateCSV(vessels: { id: string; name: string }[]): string {
  const SEP = ';';
  const v1 = vessels[0]?.name || 'My Vessel';
  const v2 = vessels[1]?.name || v1;
  const headers = [
    'name', 'part_number', 'category', 'type', 'department',
    'vessel_name', 'equipment_name', 'current_stock', 'minimum_stock',
    'unit_of_measure', 'unit_cost', 'location', 'notes',
  ];
  const examples = [
    ['MTU Engine Oil 15W-40', 'MTU-OIL-15W40',  'Lubricants',      'consumable', 'Engineering', v1, 'Main Engine Port', '45', '20', 'liters', '8.50',  'Engine Room Shelf A1',   ''],
    ['Dock Lines 12mm',       'DECK-DL-12MM',   'Deck Equipment',  'consumable', 'Deck',        v1, '',                 '4',  '2',  'pcs',   '65.00', 'Foredeck Locker A',      ''],
    ['Linen Set King',        'LIN-KING-001',   'Other',           'consumable', 'Interior',    v1, '',                 '8',  '6',  'sets',  '180.00','Linen Storage Deck 1',   ''],
    ['Dishwasher Tablets',    'DISH-TAB-001',   'Other',           'consumable', 'Galley',      v2, '',                 '120','60', 'pcs',   '0.45',  'Galley Store Shelf G1',  ''],
    ['CO2 Extinguisher 5kg',  'EXT-CO2-5KG',   'Safety Equipment','spare_part', 'Safety',      v2, '',                 '6',  '6',  'pcs',   '85.00', 'Safety Locker Main',     ''],
    ['Oil Filter Element',    '1R-0751',        'Filters',         'spare_part', 'Engineering', v1, 'Main Engine Port', '5',  '2',  'pcs',   '42.00', 'Engine Room Shelf A2',   'Primary oil filter'],
  ];
  const escape = (v: string) => v.includes(SEP) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  const rows = [headers, ...examples].map(r => r.map(escape).join(SEP));
  return '\uFEFF' + rows.join('\r\n');
}

export const ImportInventoryModal: React.FC<ImportInventoryModalProps> = ({
  vessels, equipment, onClose, onImport,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');

  const validRows = parsed.filter(r => r.errors.length === 0);
  const errorRows = parsed.filter(r => r.errors.length > 0);

  const downloadTemplate = () => {
    const csv = generateCSV(vessels);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nautium_inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      const result: ParsedRow[] = rows.map((row, i) => {
        const errors: string[] = [];
        const name             = row['name'] || '';
        const part_number      = row['part_number'] || '';
        const category         = row['category'] || '';
        const typeRaw          = (row['type'] || '').toLowerCase();
        const departmentRaw    = row['department'] || 'Engineering';
        const vesselNameRaw    = row['vessel_name'] || '';
        const equipmentNameRaw = row['equipment_name'] || '';
        const current_stock    = parseFloat(row['current_stock'] || '0');
        const minimum_stock    = parseFloat(row['minimum_stock'] || '0');
        const unitRaw          = (row['unit_of_measure'] || 'pcs').toLowerCase();
        const unit_cost_raw    = row['unit_cost'] || '';
        const location         = row['location'] || '';
        const notes            = row['notes'] || '';

        if (!name)         errors.push('name is required');
        if (!part_number)  errors.push('part_number is required');
        if (!category)     errors.push('category is required');

        const type = typeRaw === 'consumable' ? 'consumable' : 'spare_part';

        // Validate department
        const department = VALID_DEPARTMENTS.find(
          d => d.toLowerCase() === departmentRaw.toLowerCase()
        ) || 'Engineering';

        const matchedVessel = vessels.find(
          v => v.name.toLowerCase() === vesselNameRaw.toLowerCase()
        );
        if (!vesselNameRaw)    errors.push('vessel_name is required');
        else if (!matchedVessel) errors.push(`vessel "${vesselNameRaw}" not found`);

        const matchedEquipment = equipmentNameRaw
          ? equipment.find(
              eq =>
                eq.name.toLowerCase() === equipmentNameRaw.toLowerCase() &&
                (!matchedVessel || eq.vessel_id === matchedVessel.id)
            )
          : undefined;

        if (isNaN(current_stock) || current_stock < 0) errors.push('current_stock must be >= 0');
        if (isNaN(minimum_stock) || minimum_stock < 0) errors.push('minimum_stock must be >= 0');

        const unit_of_measure = UNITS.includes(unitRaw) ? unitRaw : 'pcs';
        const unit_cost = unit_cost_raw === '' ? null : parseFloat(unit_cost_raw);
        if (unit_cost_raw !== '' && isNaN(unit_cost as number)) errors.push('unit_cost must be a number or blank');

        const itemData: NewInventoryData = {
          name,
          part_number,
          category,
          type: type as 'spare_part' | 'consumable',
          department,
          vessel_id: matchedVessel?.id || '',
          equipment_id: matchedEquipment?.id || '',
          current_stock: isNaN(current_stock) ? 0 : current_stock,
          minimum_stock: isNaN(minimum_stock) ? 1 : minimum_stock,
          unit_of_measure,
          unit_cost: unit_cost_raw === '' ? null : (isNaN(unit_cost as number) ? null : unit_cost),
          location,
          notes,
          photo_url: null,
        };

        return {
          row: i + 2,
          data: itemData,
          errors,
          vesselName: matchedVessel?.name || vesselNameRaw || '—',
          equipmentName: matchedEquipment?.name || equipmentNameRaw || '—',
        };
      });
      setParsed(result);
      setStep('review');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      await onImport(validRows.map(r => r.data));
      setImportedCount(validRows.length);
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const deptColors: Record<string, string> = {
    Engineering: 'bg-orange-100 text-orange-700',
    Deck:        'bg-blue-100 text-blue-700',
    Interior:    'bg-purple-100 text-purple-700',
    Galley:      'bg-green-100 text-green-700',
    Safety:      'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Inventory from CSV / Excel</h2>
              <p className="text-xs text-gray-500">Upload a CSV file to create multiple items at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* STEP: upload */}
          {step === 'upload' && (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Download className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">Step 1 — Download the template</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Fill in your items following the column headers. Open with Excel, Numbers, or Google Sheets. Save as CSV before uploading.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download nautium_inventory_template.csv
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-2">Required columns:</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span><span className="font-medium">name</span> — item name</span>
                  <span><span className="font-medium">part_number</span> — part/ref number</span>
                  <span><span className="font-medium">category</span> — e.g. Filters, Engine Parts</span>
                  <span><span className="font-medium">type</span> — spare_part or consumable</span>
                  <span><span className="font-medium">department</span> — Engineering, Deck, Interior, Galley or Safety</span>
                  <span><span className="font-medium">vessel_name</span> — must match exactly</span>
                  <span><span className="font-medium">current_stock</span> — number</span>
                  <span><span className="font-medium">minimum_stock</span> — number</span>
                  <span><span className="font-medium">unit_of_measure</span> — pcs, liters, kg…</span>
                </div>
                <p className="text-gray-400 pt-1">Optional: equipment_name, unit_cost, location, notes</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Step 2 — Upload your completed file</p>
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700 transition-colors">Click to select your CSV file</p>
                    <p className="text-xs text-gray-400 mt-1">.csv files — export from Excel or Google Sheets as CSV</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                </label>
              </div>

              {vessels.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Available vessels (use exact name in the file):</p>
                  <div className="flex flex-wrap gap-2">
                    {vessels.map(v => (
                      <span key={v.id} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 font-medium">{v.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">File: <span className="font-medium text-gray-800">{fileName}</span></p>
                <button onClick={() => { setParsed([]); setStep('upload'); }} className="text-xs text-blue-600 hover:underline">
                  Change file
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{parsed.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
                  <p className="text-xs text-green-600 mt-0.5">Ready to import</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${errorRows.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${errorRows.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{errorRows.length}</p>
                  <p className={`text-xs mt-0.5 ${errorRows.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>Rows with errors</p>
                </div>
              </div>

              {errorRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> These rows will be skipped
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {errorRows.map(r => (
                      <div key={r.row} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <span className="text-xs font-mono text-red-400 flex-shrink-0 mt-0.5">Row {r.row}</span>
                        <span className="text-xs text-red-700">{r.data.name || '(no name)'} — {r.errors.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Preview of valid items:</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {['Name', 'Part #', 'Category', 'Dept', 'Type', 'Vessel', 'Stock', 'Min', 'Unit'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {validRows.map(r => (
                            <tr key={r.row} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-800 font-medium max-w-[140px] truncate">{r.data.name}</td>
                              <td className="px-3 py-2 text-gray-500 font-mono">{r.data.part_number}</td>
                              <td className="px-3 py-2 text-gray-600">{r.data.category}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${deptColors[(r.data as any).department] || 'bg-gray-100 text-gray-600'}`}>
                                  {(r.data as any).department || 'Engineering'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.data.type === 'spare_part' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {r.data.type === 'spare_part' ? 'Spare' : 'Consumable'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.vesselName}</td>
                              <td className="px-3 py-2 text-gray-800 font-medium">{r.data.current_stock}</td>
                              <td className="px-3 py-2 text-gray-500">{r.data.minimum_stock}</td>
                              <td className="px-3 py-2 text-gray-500">{r.data.unit_of_measure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {validRows.length === 0 && (
                <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">No valid rows found. Please fix the errors and re-upload.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">Import complete</p>
                <p className="text-sm text-gray-500 mt-1">
                  {importedCount} item{importedCount !== 1 ? 's' : ''} added to inventory successfully.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          {step === 'done' ? (
            <button onClick={onClose} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
              Close
            </button>
          ) : step === 'review' ? (
            <>
              <button onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <>Import {validRows.length} item{validRows.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
