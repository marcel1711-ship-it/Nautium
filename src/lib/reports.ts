import { MaintenanceTask, InventoryItem } from '../types';
import { calculateDaysUntilDue, isLowStock, downloadHTML } from '../utils/helpers';

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
    const color = pct < 25 ? '#dc2626' : pct < 50 ? '#d97706' : '#059669';
    return `<tr>
      <td style="font-weight:600">${r.name}</td>
      <td class="num">${r.current_level.toLocaleString()} ${r.unit}</td>
      <td class="num">${r.capacity.toLocaleString()} ${r.unit}</td>
      <td><div class="fuel-bar-bg"><div class="fuel-bar-fill" style="width:${pct}%;background:${color}"></div></div></td>
      <td class="num"><span class="fuel-pct" style="color:${color}">${pct}%</span></td>
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
      <td style="font-weight:600">${t.title}</td>
      <td><span class="badge ${t.priority}">${t.priority}</span></td>
      <td class="num" style="color:#dc2626;font-weight:700">${Math.abs(calculateDaysUntilDue(t.next_due_date))} days overdue</td>
    </tr>
  `).join('');

  const upcomingRows = upcomingTasks.slice(0, 10).map(t => `
    <tr>
      <td style="font-weight:600">${t.title}</td>
      <td><span class="badge ${t.priority}">${t.priority}</span></td>
      <td class="num">${calculateDaysUntilDue(t.next_due_date)} days</td>
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
@page{margin:0;size:A4 landscape;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;font-size:11px;background:#fff;line-height:1.5;}

/* ── COVER HEADER ─────────────────────────────────────── */
.cover{background:linear-gradient(135deg,#0c1929 0%,#163356 50%,#1e4976 100%);color:#fff;padding:40px 48px 36px;position:relative;overflow:hidden;}
.cover::after{content:'';position:absolute;top:-60px;right:-60px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,0.03);}
.cover::before{content:'';position:absolute;bottom:-40px;right:120px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.02);}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;}
.brand{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:16px;}
.vessel-name{font-size:32px;font-weight:800;letter-spacing:-0.5px;line-height:1.15;}
.vessel-meta{font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;font-weight:400;}
.report-badge{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 22px;text-align:right;backdrop-filter:blur(8px);}
.report-badge .period{font-size:15px;font-weight:700;letter-spacing:-0.2px;}
.report-badge .gen{font-size:9px;color:rgba(255,255,255,0.45);margin-top:4px;}

/* ── EXECUTIVE SUMMARY ────────────────────────────────── */
.exec-bar{display:flex;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
.exec-item{flex:1;padding:20px 24px;text-align:center;border-right:1px solid #e2e8f0;position:relative;}
.exec-item:last-child{border-right:none;}
.exec-val{font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1;}
.exec-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:6px;}
.exec-dot{width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle;position:relative;top:-1px;}
.c-green{color:#059669;} .c-amber{color:#d97706;} .c-red{color:#dc2626;} .c-blue{color:#2563eb;} .c-slate{color:#475569;}
.bg-green{background:#059669;} .bg-amber{background:#d97706;} .bg-red{background:#dc2626;}

/* ── ALERTS ───────────────────────────────────────────── */
.alert{margin:20px 48px 0;padding:14px 20px;border-radius:10px;font-size:11px;display:flex;align-items:flex-start;gap:10px;}
.alert.critical{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;}
.alert.warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e;}
.alert-icon{font-size:16px;line-height:1;flex-shrink:0;margin-top:1px;}
.alert-text strong{font-weight:700;}

/* ── SECTIONS ─────────────────────────────────────────── */
.section{padding:24px 48px;}
.section + .section{border-top:1px solid #f1f5f9;}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.section-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;}
.section-icon.finance{background:#eff6ff;color:#2563eb;}
.section-icon.fuel{background:#ecfdf5;color:#059669;}
.section-icon.maint{background:#fef3c7;color:#d97706;}
.section-icon.inv{background:#f3e8ff;color:#7c3aed;}
.section-icon.cert{background:#fef2f2;color:#dc2626;}
.section-icon.proc{background:#e0f2fe;color:#0284c7;}
.section-title{font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;}
.section-subtitle{font-size:10px;color:#94a3b8;font-weight:500;}

/* ── KPI CARDS ────────────────────────────────────────── */
.kpi-row{display:flex;gap:12px;margin-bottom:18px;}
.kpi{flex:1;padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:linear-gradient(135deg,#fff,#f8fafc);}
.kpi-val{font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#0f172a;}
.kpi-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-top:4px;}
.kpi-accent{border-left:3px solid;}

/* ── TABLES ───────────────────────────────────────────── */
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;}
th{text-align:left;padding:10px 14px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
td{padding:10px 14px;font-size:11px;border-bottom:1px solid #f1f5f9;color:#334155;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#fafbfd;}
.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
.sub-header{font-weight:700;font-size:11px;margin:18px 0 8px;padding-left:2px;display:flex;align-items:center;gap:6px;}
.sub-header .dot{width:8px;height:8px;border-radius:50%;}

/* ── FUEL BARS ────────────────────────────────────────── */
.fuel-bar-bg{width:120px;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;}
.fuel-bar-fill{height:100%;border-radius:5px;}
.fuel-pct{font-weight:800;font-size:12px;}

/* ── PRIORITY BADGES ──────────────────────────────────── */
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;}
.badge.critical{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
.badge.high{background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;}
.badge.medium{background:#fffbeb;color:#d97706;border:1px solid #fde68a;}
.badge.low{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;}

/* ── FOOTER ───────────────────────────────────────────── */
.footer{padding:24px 48px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;}
.footer-brand{font-size:11px;font-weight:700;color:#163356;letter-spacing:1px;}
.footer-info{text-align:right;font-size:9px;color:#94a3b8;}
.footer-info a{color:#2563eb;text-decoration:none;}
.footer-line{width:40px;height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:2px;margin-bottom:6px;}

.empty{padding:24px;text-align:center;color:#94a3b8;font-style:italic;font-size:12px;}

@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .section{break-inside:avoid;}
}
</style></head><body>

<!-- ═══ COVER ═══ -->
<div class="cover">
  <div class="cover-top">
    <div>
      <div class="brand">Nautium</div>
      <div class="vessel-name">${data.vessel.vesselName}</div>
      <div class="vessel-meta">${vesselInfo || 'Managed Vessel'}</div>
    </div>
    <div class="report-badge">
      <div class="period">${monthYear}</div>
      <div class="gen">Generated ${dateStr}</div>
      <div class="gen">by ${data.generatedBy}</div>
    </div>
  </div>
</div>

<!-- ═══ EXECUTIVE SUMMARY BAR ═══ -->
<div class="exec-bar">
  <div class="exec-item">
    <div class="exec-val ${maintenanceHealth >= 80 ? 'c-green' : maintenanceHealth >= 50 ? 'c-amber' : 'c-red'}">${maintenanceHealth}%</div>
    <div class="exec-lbl"><span class="exec-dot ${maintenanceHealth >= 80 ? 'bg-green' : maintenanceHealth >= 50 ? 'bg-amber' : 'bg-red'}"></span>Maintenance Health</div>
  </div>
  <div class="exec-item">
    <div class="exec-val ${overdueTasks.length === 0 ? 'c-green' : 'c-red'}">${overdueTasks.length}</div>
    <div class="exec-lbl">Overdue Tasks</div>
  </div>
  <div class="exec-item">
    <div class="exec-val ${lowStockItems.length === 0 ? 'c-green' : 'c-amber'}">${lowStockItems.length}</div>
    <div class="exec-lbl">Low Stock Items</div>
  </div>
  <div class="exec-item">
    <div class="exec-val ${expiredCerts.length === 0 ? 'c-green' : 'c-red'}">${expiredCerts.length}</div>
    <div class="exec-lbl">Expired Certificates</div>
  </div>
  <div class="exec-item">
    <div class="exec-val c-blue">${fmt(totalInventoryValue, cur)}</div>
    <div class="exec-lbl">Inventory Value</div>
  </div>
</div>

${overdueTasks.length > 0 || expiredCerts.length > 0 ? `
<div class="alert critical">
  <div class="alert-icon">⚠</div>
  <div class="alert-text">
    <strong>Attention Required</strong> —
    ${overdueTasks.length > 0 ? `${overdueTasks.length} overdue maintenance task${overdueTasks.length > 1 ? 's' : ''}` : ''}
    ${overdueTasks.length > 0 && expiredCerts.length > 0 ? ' and ' : ''}
    ${expiredCerts.length > 0 ? `${expiredCerts.length} expired certificate${expiredCerts.length > 1 ? 's' : ''}` : ''}
    ${lowStockItems.length > 0 ? ` · ${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} below minimum stock` : ''}
  </div>
</div>` : lowStockItems.length > 0 ? `
<div class="alert warning">
  <div class="alert-icon">⚠</div>
  <div class="alert-text"><strong>Stock Alert</strong> — ${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} below minimum stock level</div>
</div>` : ''}

<!-- ═══ FINANCIAL SUMMARY ═══ -->
<div class="section">
  <div class="section-header">
    <div class="section-icon finance">$</div>
    <div><div class="section-title">Financial Summary</div><div class="section-subtitle">Operating expenses overview</div></div>
  </div>
  ${data.costs.months.length > 0 ? `
  <div class="kpi-row">
    ${data.costs.months.map(m => `
      <div class="kpi kpi-accent" style="border-left-color:#2563eb;">
        <div class="kpi-val">${fmt(m.total, cur)}</div>
        <div class="kpi-lbl">${m.month}</div>
      </div>
    `).join('')}
    <div class="kpi kpi-accent" style="border-left-color:#0f172a;">
      <div class="kpi-val" style="color:#0f172a;">${fmt(data.costs.months.reduce((s, m) => s + m.total, 0), cur)}</div>
      <div class="kpi-lbl">Total (${data.costs.months.length} mo.)</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Month</th><th class="num">Total</th><th>Top Categories</th></tr></thead>
    <tbody>${costRows}</tbody>
  </table>` : '<p class="empty">No cost data available for this period</p>'}
</div>

<!-- ═══ PROCUREMENT ═══ -->
${data.procurement.pending > 0 || data.procurement.approved > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="section-icon proc">⬡</div>
    <div><div class="section-title">Procurement</div><div class="section-subtitle">Purchase requests & orders</div></div>
  </div>
  <div class="kpi-row">
    <div class="kpi kpi-accent" style="border-left-color:#d97706;"><div class="kpi-val c-amber">${data.procurement.pending}</div><div class="kpi-lbl">Pending PRs</div></div>
    <div class="kpi kpi-accent" style="border-left-color:#059669;"><div class="kpi-val c-green">${data.procurement.approved}</div><div class="kpi-lbl">Active POs</div></div>
    <div class="kpi kpi-accent" style="border-left-color:#2563eb;"><div class="kpi-val c-blue">${fmt(data.procurement.totalValue, cur)}</div><div class="kpi-lbl">Total Value</div></div>
  </div>
</div>` : ''}

<!-- ═══ FUEL & CONSUMABLES ═══ -->
${data.fuel.resources.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="section-icon fuel">⛽</div>
    <div><div class="section-title">Fuel & Consumables</div><div class="section-subtitle">Tank levels and capacity</div></div>
  </div>
  <table>
    <thead><tr><th>Resource</th><th class="num">Current</th><th class="num">Capacity</th><th style="width:140px">Level</th><th class="num">%</th></tr></thead>
    <tbody>${fuelRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ MAINTENANCE ═══ -->
<div class="section">
  <div class="section-header">
    <div class="section-icon maint">⚙</div>
    <div><div class="section-title">Maintenance</div><div class="section-subtitle">Task overview and recent activity</div></div>
  </div>
  <div class="kpi-row">
    <div class="kpi kpi-accent" style="border-left-color:#475569;"><div class="kpi-val c-slate">${data.maintenance.tasks.length}</div><div class="kpi-lbl">Total Tasks</div></div>
    <div class="kpi kpi-accent" style="border-left-color:#dc2626;"><div class="kpi-val ${overdueTasks.length > 0 ? 'c-red' : 'c-green'}">${overdueTasks.length}</div><div class="kpi-lbl">Overdue</div></div>
    <div class="kpi kpi-accent" style="border-left-color:#d97706;"><div class="kpi-val c-amber">${upcomingTasks.length}</div><div class="kpi-lbl">Due in 14 Days</div></div>
    <div class="kpi kpi-accent" style="border-left-color:#059669;"><div class="kpi-val c-green">${completedTasks.length}</div><div class="kpi-lbl">Completed</div></div>
  </div>

  ${overdueTasks.length > 0 ? `
  <div class="sub-header"><div class="dot bg-red"></div>Overdue Tasks</div>
  <table>
    <thead><tr><th>Task</th><th>Priority</th><th class="num">Status</th></tr></thead>
    <tbody>${overdueRows}</tbody>
  </table>` : ''}

  ${upcomingTasks.length > 0 ? `
  <div class="sub-header" style="margin-top:20px;"><div class="dot bg-amber"></div>Upcoming — Next 14 Days</div>
  <table>
    <thead><tr><th>Task</th><th>Priority</th><th class="num">Due In</th></tr></thead>
    <tbody>${upcomingRows}</tbody>
  </table>` : ''}

  ${data.maintenance.recentHistory.length > 0 ? `
  <div class="sub-header" style="margin-top:20px;"><div class="dot bg-green"></div>Recently Completed</div>
  <table>
    <thead><tr><th>Task</th><th>Completed</th><th>By</th></tr></thead>
    <tbody>${recentHistoryRows}</tbody>
  </table>` : ''}
</div>

<!-- ═══ INVENTORY ═══ -->
${lowStockItems.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="section-icon inv">📦</div>
    <div><div class="section-title">Inventory — Low Stock Alerts</div><div class="section-subtitle">Items below minimum stock level</div></div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Part Number</th><th class="num">Current Stock</th><th class="num">Minimum Required</th></tr></thead>
    <tbody>${lowStockRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ COMPLIANCE ═══ -->
${expiredCerts.length > 0 ? `
<div class="section">
  <div class="section-header">
    <div class="section-icon cert">🛡</div>
    <div><div class="section-title">Compliance — Expired Certificates</div><div class="section-subtitle">Requires immediate attention</div></div>
  </div>
  <table>
    <thead><tr><th>Certificate</th><th>Expiry Date</th></tr></thead>
    <tbody>${expiredCertRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ FOOTER ═══ -->
<div class="footer">
  <div>
    <div class="footer-line"></div>
    <div class="footer-brand">NAUTIUM</div>
  </div>
  <div class="footer-info">
    ${data.vessel.vesselName} · Monthly Owner Report · ${dateStr}<br/>
    Generated automatically — For full details visit your Nautium dashboard
  </div>
</div>

</body></html>`;
}

export function downloadReport(html: string, vesselName: string) {
  const now = new Date();
  downloadHTML(html, `${vesselName.replace(/\s+/g, '-')}-report-${now.toISOString().slice(0, 10)}.html`);
}
