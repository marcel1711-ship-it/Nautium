import { MaintenanceTask, InventoryItem } from '../types';
import { calculateDaysUntilDue, isLowStock, downloadPDF } from '../utils/helpers';

interface VesselReport {
  vesselName: string;
  vesselType?: string;
  vesselFlag?: string;
  vesselLength?: string;
}

interface MaintenanceReport {
  tasks: MaintenanceTask[];
  recentHistory: { task_name?: string; completion_date: string; completed_by_name?: string }[];
}

interface InventoryReport {
  items: InventoryItem[];
}

interface CostReport {
  months: { month: string; total: number; items: { label: string; amount: number }[] }[];
  currency?: string;
}

interface FuelReport {
  resources: { name: string; current_level: number; capacity: number; unit: string }[];
}

interface ComplianceReport {
  items: { title: string; expiry_date?: string; status?: string }[];
}

interface PRReport {
  pending: number;
  approved: number;
  totalValue: number;
}

export interface OwnerReportData {
  vessel: VesselReport;
  maintenance: MaintenanceReport;
  inventory: InventoryReport;
  costs: CostReport;
  fuel: FuelReport;
  compliance: ComplianceReport;
  procurement: PRReport;
  generatedBy: string;
}

const fmt = (n: number, currency = 'EUR') => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function generateOwnerReport(data: OwnerReportData): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const monthYear = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const cur = data.costs.currency || 'EUR';

  const overdueTasks = data.maintenance.tasks.filter(t => {
    const days = calculateDaysUntilDue(t.next_due_date);
    return days < 0 && t.status !== 'completed';
  });
  const upcomingTasks = data.maintenance.tasks.filter(t => {
    const days = calculateDaysUntilDue(t.next_due_date);
    return days >= 0 && days <= 14 && t.status !== 'completed';
  });
  const completedTasks = data.maintenance.tasks.filter(t => t.status === 'completed');

  const lowStockItems = data.inventory.items.filter(i => isLowStock(i));
  const totalInventoryValue = data.inventory.items.reduce((s, i) => s + (i.current_stock * (i.unit_cost || 0)), 0);

  const expiredCerts = data.compliance.items.filter(c => {
    if (!c.expiry_date) return false;
    return new Date(c.expiry_date) < now;
  });

  const maintenanceHealth = data.maintenance.tasks.length > 0
    ? Math.round(((data.maintenance.tasks.length - overdueTasks.length) / data.maintenance.tasks.length) * 100)
    : 100;

  const fuelRows = data.fuel.resources.map(r => {
    const pct = r.capacity > 0 ? Math.round((r.current_level / r.capacity) * 100) : 0;
    const color = pct < 25 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#22c55e';
    return `<tr>
      <td>${r.name}</td>
      <td class="num">${r.current_level.toLocaleString()} ${r.unit}</td>
      <td class="num">${r.capacity.toLocaleString()} ${r.unit}</td>
      <td><div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div></td>
      <td class="num" style="color:${color};font-weight:700">${pct}%</td>
    </tr>`;
  }).join('');

  const costRows = data.costs.months.map(m => `
    <tr>
      <td style="font-weight:600">${m.month}</td>
      <td class="num" style="font-weight:700">${fmt(m.total, cur)}</td>
      <td>${m.items.map(i => `${i.label}: ${fmt(i.amount, cur)}`).join(' · ')}</td>
    </tr>
  `).join('');

  const overdueRows = overdueTasks.slice(0, 10).map(t => `
    <tr>
      <td>${t.title}</td>
      <td>${t.priority}</td>
      <td style="color:#ef4444;font-weight:600">${Math.abs(calculateDaysUntilDue(t.next_due_date))} days overdue</td>
    </tr>
  `).join('');

  const upcomingRows = upcomingTasks.slice(0, 10).map(t => `
    <tr>
      <td>${t.title}</td>
      <td>${t.priority}</td>
      <td>${calculateDaysUntilDue(t.next_due_date)} days</td>
    </tr>
  `).join('');

  const lowStockRows = lowStockItems.slice(0, 10).map(i => `
    <tr>
      <td>${i.name}</td>
      <td>${i.part_number || '—'}</td>
      <td class="num" style="color:${i.current_stock === 0 ? '#ef4444' : '#f59e0b'};font-weight:600">${i.current_stock}</td>
      <td class="num">${i.minimum_stock}</td>
    </tr>
  `).join('');

  const recentHistoryRows = data.maintenance.recentHistory.slice(0, 5).map(h => `
    <tr>
      <td>${h.task_name || '—'}</td>
      <td>${new Date(h.completion_date).toLocaleDateString('en-GB')}</td>
      <td>${h.completed_by_name || '—'}</td>
    </tr>
  `).join('');

  const expiredCertRows = expiredCerts.slice(0, 10).map(c => `
    <tr>
      <td>${c.title}</td>
      <td style="color:#ef4444;font-weight:600">${c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-GB') : '—'}</td>
    </tr>
  `).join('');

  const vesselInfo = [data.vessel.vesselType, data.vessel.vesselLength, data.vessel.vesselFlag].filter(Boolean).join(' · ');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${data.vessel.vesselName} — Owner Report — ${monthYear}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a1a1a;font-size:11px;background:#fff;}
.header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-end;}
.header h1{font-size:22px;font-weight:800;letter-spacing:-0.3px;}
.header .sub{font-size:11px;opacity:.7;margin-top:4px;}
.header .right{text-align:right;}
.header .date{font-size:13px;font-weight:600;}
.header .gen{font-size:9px;opacity:.5;margin-top:4px;}

.status-bar{display:flex;gap:0;border-bottom:2px solid #e5e7eb;}
.status-item{flex:1;padding:14px 20px;text-align:center;border-right:1px solid #e5e7eb;}
.status-item:last-child{border-right:none;}
.status-item .val{font-size:24px;font-weight:800;}
.status-item .lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
.green{color:#16a34a;} .amber{color:#d97706;} .red{color:#ef4444;} .blue{color:#2563eb;}

.section{padding:20px 32px;}
.section + .section{border-top:1px solid #f0f0f0;}
.section h2{font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.section h2::before{content:'';width:4px;height:18px;background:#2563eb;border-radius:2px;}

table{width:100%;border-collapse:collapse;}
th{text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#6b7280;border-bottom:2px solid #e5e7eb;background:#fafafa;}
td{padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;}
.num{text-align:right;font-variant-numeric:tabular-nums;}

.bar-bg{width:100px;height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;transition:width .3s;}

.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
.kpi{padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;}
.kpi .val{font-size:20px;font-weight:800;color:#111827;}
.kpi .lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;}

.alert-box{margin:16px 32px;padding:12px 16px;border-radius:10px;font-size:11px;}
.alert-box.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;}
.alert-box.danger{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;}
.alert-box strong{display:block;margin-bottom:4px;}

.footer{padding:16px 32px;border-top:2px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;}
.footer strong{color:#1e3a5f;}

.empty{padding:20px;text-align:center;color:#9ca3af;font-style:italic;}

@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .section{break-inside:avoid;}
}
</style></head><body>

<div class="header">
  <div>
    <h1>${data.vessel.vesselName}</h1>
    <p class="sub">${vesselInfo || 'Managed Vessel'}</p>
  </div>
  <div class="right">
    <p class="date">Monthly Report — ${monthYear}</p>
    <p class="gen">Generated ${dateStr} by ${data.generatedBy}</p>
  </div>
</div>

<!-- STATUS BAR -->
<div class="status-bar">
  <div class="status-item">
    <div class="val ${maintenanceHealth >= 80 ? 'green' : maintenanceHealth >= 50 ? 'amber' : 'red'}">${maintenanceHealth}%</div>
    <div class="lbl">Maintenance Health</div>
  </div>
  <div class="status-item">
    <div class="val ${overdueTasks.length === 0 ? 'green' : 'red'}">${overdueTasks.length}</div>
    <div class="lbl">Overdue Tasks</div>
  </div>
  <div class="status-item">
    <div class="val ${lowStockItems.length === 0 ? 'green' : 'amber'}">${lowStockItems.length}</div>
    <div class="lbl">Low Stock Items</div>
  </div>
  <div class="status-item">
    <div class="val ${expiredCerts.length === 0 ? 'green' : 'red'}">${expiredCerts.length}</div>
    <div class="lbl">Expired Certs</div>
  </div>
  <div class="status-item">
    <div class="val blue">${fmt(totalInventoryValue, cur)}</div>
    <div class="lbl">Inventory Value</div>
  </div>
</div>

${overdueTasks.length > 0 || expiredCerts.length > 0 || lowStockItems.length > 0 ? `
<div class="alert-box ${overdueTasks.length > 0 || expiredCerts.length > 0 ? 'danger' : 'warn'}">
  <strong>Attention Required</strong>
  ${overdueTasks.length > 0 ? `${overdueTasks.length} overdue maintenance task${overdueTasks.length > 1 ? 's' : ''} · ` : ''}
  ${expiredCerts.length > 0 ? `${expiredCerts.length} expired certificate${expiredCerts.length > 1 ? 's' : ''} · ` : ''}
  ${lowStockItems.length > 0 ? `${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} below minimum stock` : ''}
</div>` : ''}

<!-- COSTS -->
<div class="section">
  <h2>Financial Summary</h2>
  ${data.costs.months.length > 0 ? `
  <div class="kpi-grid">
    ${data.costs.months.map(m => `
      <div class="kpi">
        <div class="val">${fmt(m.total, cur)}</div>
        <div class="lbl">${m.month}</div>
      </div>
    `).join('')}
    <div class="kpi">
      <div class="val">${fmt(data.costs.months.reduce((s, m) => s + m.total, 0), cur)}</div>
      <div class="lbl">Total (${data.costs.months.length} months)</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Month</th><th style="text-align:right">Total</th><th>Top Categories</th></tr></thead>
    <tbody>${costRows}</tbody>
  </table>` : '<p class="empty">No cost data available</p>'}
</div>

<!-- PROCUREMENT -->
${data.procurement.pending > 0 || data.procurement.approved > 0 ? `
<div class="section">
  <h2>Procurement</h2>
  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">
    <div class="kpi"><div class="val amber">${data.procurement.pending}</div><div class="lbl">Pending PRs</div></div>
    <div class="kpi"><div class="val green">${data.procurement.approved}</div><div class="lbl">Active POs</div></div>
    <div class="kpi"><div class="val blue">${fmt(data.procurement.totalValue, cur)}</div><div class="lbl">Total Value</div></div>
  </div>
</div>` : ''}

<!-- FUEL -->
${data.fuel.resources.length > 0 ? `
<div class="section">
  <h2>Fuel & Consumables</h2>
  <table>
    <thead><tr><th>Resource</th><th style="text-align:right">Current</th><th style="text-align:right">Capacity</th><th>Level</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${fuelRows}</tbody>
  </table>
</div>` : ''}

<!-- MAINTENANCE -->
<div class="section">
  <h2>Maintenance</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${data.maintenance.tasks.length}</div><div class="lbl">Total Tasks</div></div>
    <div class="kpi"><div class="val ${overdueTasks.length > 0 ? 'red' : 'green'}">${overdueTasks.length}</div><div class="lbl">Overdue</div></div>
    <div class="kpi"><div class="val amber">${upcomingTasks.length}</div><div class="lbl">Due in 14 days</div></div>
    <div class="kpi"><div class="val green">${completedTasks.length}</div><div class="lbl">Completed</div></div>
  </div>

  ${overdueTasks.length > 0 ? `
  <p style="font-weight:700;font-size:11px;margin:12px 0 6px;color:#991b1b;">Overdue Tasks</p>
  <table>
    <thead><tr><th>Task</th><th>Priority</th><th>Status</th></tr></thead>
    <tbody>${overdueRows}</tbody>
  </table>` : ''}

  ${upcomingTasks.length > 0 ? `
  <p style="font-weight:700;font-size:11px;margin:16px 0 6px;color:#92400e;">Upcoming (next 14 days)</p>
  <table>
    <thead><tr><th>Task</th><th>Priority</th><th>Due In</th></tr></thead>
    <tbody>${upcomingRows}</tbody>
  </table>` : ''}

  ${data.maintenance.recentHistory.length > 0 ? `
  <p style="font-weight:700;font-size:11px;margin:16px 0 6px;color:#166534;">Recently Completed</p>
  <table>
    <thead><tr><th>Task</th><th>Completed</th><th>By</th></tr></thead>
    <tbody>${recentHistoryRows}</tbody>
  </table>` : ''}
</div>

<!-- INVENTORY -->
${lowStockItems.length > 0 ? `
<div class="section">
  <h2>Inventory — Low Stock Alerts</h2>
  <table>
    <thead><tr><th>Item</th><th>Part #</th><th style="text-align:right">Current</th><th style="text-align:right">Minimum</th></tr></thead>
    <tbody>${lowStockRows}</tbody>
  </table>
</div>` : ''}

<!-- COMPLIANCE -->
${expiredCerts.length > 0 ? `
<div class="section">
  <h2>Compliance — Expired Certificates</h2>
  <table>
    <thead><tr><th>Certificate</th><th>Expired</th></tr></thead>
    <tbody>${expiredCertRows}</tbody>
  </table>
</div>` : ''}

<div class="footer">
  <strong>Nautium</strong> — ${data.vessel.vesselName} Monthly Report — ${dateStr}<br/>
  This report was generated automatically. For details, log in to your Nautium dashboard.
</div>

</body></html>`;
}

export function downloadReport(html: string, vesselName: string) {
  const now = new Date();
  downloadPDF(html, `${vesselName.replace(/\s+/g, '-')}-report-${now.toISOString().slice(0, 10)}.pdf`);
}
