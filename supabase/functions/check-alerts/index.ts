import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OverdueTask {
  id: string;
  title: string;
  next_due_date: string;
  priority: string;
  status: string;
  vessel_name: string;
  assigned_user_email: string | null;
}

interface LowStockItem {
  id: string;
  name: string;
  current_stock: number;
  minimum_stock: number;
  unit_of_measure: string;
  vessel_name: string;
}

interface VesselAlertData {
  vesselId: string;
  vesselName: string;
  overdue: OverdueTask[];
  lowStock: LowStockItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fromEmail = Deno.env.get("ALERT_FROM_EMAIL") ?? "Nautium <hello@nautium.app>";

    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, contact_email, notification_emails")
      .eq("email_notifications_enabled", true);

    if (companiesError) throw companiesError;
    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: "No companies with notifications enabled", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    const results: { company: string; sent: boolean; perVessel?: number; error?: string }[] = [];

    for (const company of companies) {
      try {
        const { data: vessels } = await supabase
          .from("vessels")
          .select("id, name, notification_email")
          .eq("company_id", company.id);

        const companyVessels = vessels ?? [];
        const vesselIds = companyVessels.map((v: any) => v.id);
        if (vesselIds.length === 0) continue;

        const { data: overdueTasks } = await supabase
          .from("maintenance_tasks")
          .select("id, title, next_due_date, priority, status, vessel_id, vessels(name), profiles:assigned_user_id(email)")
          .eq("company_id", company.id)
          .in("status", ["overdue", "due_soon"])
          .lte("next_due_date", threeDaysStr)
          .neq("status", "completed")
          .order("next_due_date", { ascending: true });

        const { data: allInventory } = await supabase
          .from("inventory_items")
          .select("id, name, current_stock, minimum_stock, unit_of_measure, vessel_id, vessels(name)")
          .eq("company_id", company.id);

        // Group alerts by vessel
        const vesselAlertMap = new Map<string, VesselAlertData>();
        for (const v of companyVessels) {
          vesselAlertMap.set(v.id, { vesselId: v.id, vesselName: v.name, overdue: [], lowStock: [] });
        }

        for (const t of (overdueTasks ?? [])) {
          const entry = vesselAlertMap.get(t.vessel_id);
          if (entry) {
            entry.overdue.push({
              id: t.id,
              title: t.title,
              next_due_date: t.next_due_date,
              priority: t.priority,
              status: t.status,
              vessel_name: (t.vessels as any)?.name ?? "Unknown",
              assigned_user_email: (t.profiles as any)?.email ?? null,
            });
          }
        }

        for (const item of (allInventory ?? [])) {
          if (item.current_stock <= item.minimum_stock) {
            const entry = vesselAlertMap.get(item.vessel_id);
            if (entry) {
              entry.lowStock.push({
                id: item.id,
                name: item.name,
                current_stock: item.current_stock,
                minimum_stock: item.minimum_stock,
                unit_of_measure: item.unit_of_measure,
                vessel_name: (item.vessels as any)?.name ?? "Unknown",
              });
            }
          }
        }

        const vesselAlerts = Array.from(vesselAlertMap.values());
        const vesselsWithAlerts = vesselAlerts.filter(v => v.overdue.length > 0 || v.lowStock.length > 0);
        if (vesselsWithAlerts.length === 0) continue;

        // Company consolidated email
        const recipientSet = new Set<string>();
        if (company.contact_email) recipientSet.add(company.contact_email.toLowerCase());
        (company.notification_emails ?? []).forEach((e: string) => recipientSet.add(e.toLowerCase()));

        const { data: users } = await supabase
          .from("profiles")
          .select("email")
          .eq("company_id", company.id)
          .eq("status", "active");
        (users ?? []).forEach((u: { email: string }) => {
          if (u.email) recipientSet.add(u.email.toLowerCase());
        });

        const companyRecipients = Array.from(recipientSet);
        if (companyRecipients.length > 0) {
          const totalOverdue = vesselsWithAlerts.reduce((n, v) => n + v.overdue.length, 0);
          const totalLowStock = vesselsWithAlerts.reduce((n, v) => n + v.lowStock.length, 0);
          await sendEmail(
            resendApiKey, fromEmail, companyRecipients,
            buildSubject(totalOverdue, totalLowStock, company.name),
            buildCompanyEmail(company.name, vesselsWithAlerts),
            buildCompanyText(company.name, vesselsWithAlerts)
          );
          totalSent++;
        }

        // Per-vessel emails
        let perVesselCount = 0;
        for (const v of companyVessels) {
          const notifEmail = (v as any).notification_email;
          if (!notifEmail) continue;
          const alerts = vesselAlertMap.get(v.id);
          if (!alerts || (alerts.overdue.length === 0 && alerts.lowStock.length === 0)) continue;

          await sendEmail(
            resendApiKey, fromEmail, [notifEmail.toLowerCase()],
            buildSubject(alerts.overdue.length, alerts.lowStock.length, v.name),
            buildVesselEmail(company.name, alerts),
            buildVesselText(company.name, alerts)
          );
          perVesselCount++;
          totalSent++;
        }

        results.push({ company: company.name, sent: true, perVessel: perVesselCount });
      } catch (companyErr: any) {
        console.error(`Error processing company ${company.name}:`, companyErr);
        results.push({ company: company.name, sent: false, error: companyErr.message });
      }
    }

    return new Response(
      JSON.stringify({ message: "Alerts processed", totalSent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("check-alerts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendEmail(apiKey: string, from: string, to: string[], subject: string, html: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

function buildSubject(overdueCount: number, lowStockCount: number, name: string): string {
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} maintenance alert${overdueCount > 1 ? "s" : ""}`);
  if (lowStockCount > 0) parts.push(`${lowStockCount} low stock alert${lowStockCount > 1 ? "s" : ""}`);
  return `[Nautium] ${parts.join(" & ")} — ${name}`;
}

function vesselBlock(v: VesselAlertData): string {
  const maintRows = v.overdue.map(t => {
    const dueDate = new Date(t.next_due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const isOverdue = new Date(t.next_due_date) < new Date();
    const statusColor = isOverdue ? "#dc2626" : "#d97706";
    const statusLabel = isOverdue ? "OVERDUE" : "DUE SOON";
    const pc: Record<string, string> = { critical: "#dc2626", high: "#d97706", medium: "#2563eb", low: "#6b7280" };
    return `<tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:500;">${t.title}</td>
      <td style="padding:10px 14px;font-size:12px;color:${statusColor};font-weight:600;">${statusLabel}</td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;">${dueDate}</td>
      <td style="padding:10px 14px;"><span style="padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:600;text-transform:uppercase;color:white;background:${pc[t.priority] ?? "#6b7280"};">${t.priority}</span></td>
    </tr>`;
  }).join("");

  const stockRows = v.lowStock.map(item => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:500;">${item.name}</td>
      <td style="padding:10px 14px;font-size:13px;color:#dc2626;font-weight:700;">${item.current_stock} ${item.unit_of_measure}</td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;">${item.minimum_stock} ${item.unit_of_measure}</td>
    </tr>`).join("");

  const summary: string[] = [];
  if (v.overdue.length > 0) summary.push(`${v.overdue.length} maintenance`);
  if (v.lowStock.length > 0) summary.push(`${v.lowStock.length} low stock`);

  const maintTable = maintRows ? `
    <p style="margin:12px 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Maintenance</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Task</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Status</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Due</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Priority</th>
      </tr></thead>
      <tbody>${maintRows}</tbody>
    </table>` : "";

  const stockTable = stockRows ? `
    <p style="margin:12px 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Low Stock</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Item</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Current Stock</th>
        <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">Min. Required</th>
      </tr></thead>
      <tbody>${stockRows}</tbody>
    </table>` : "";

  return `
    <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:12px 16px;">
        <span style="font-size:14px;font-weight:700;color:#fff;">${v.vesselName}</span>
        <span style="float:right;font-size:11px;color:#94a3b8;">${summary.join(" · ")}</span>
      </div>
      <div style="padding:14px 16px;background:#fff;">${maintTable}${stockTable}</div>
    </div>`;
}

function emailWrapper(companyName: string, bannerText: string, body: string, footer: string): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 32px 20px;border-radius:12px 12px 0 0;text-align:center;">
    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Nautium</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Fleet Management System</p>
  </td></tr>
  <tr><td style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 32px;">
    <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">Daily Alert Summary — ${today}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#78350f;">${bannerText}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
    ${body}
    <div style="border-top:1px solid #f3f4f6;padding-top:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated alert from Nautium. Log in to your dashboard to take action.</p>
    </div>
  </td></tr>
  <tr><td style="padding:16px 0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${footer}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildCompanyEmail(companyName: string, vessels: VesselAlertData[]): string {
  const totalOverdue = vessels.reduce((n, v) => n + v.overdue.length, 0);
  const totalLowStock = vessels.reduce((n, v) => n + v.lowStock.length, 0);
  const parts: string[] = [];
  if (totalOverdue > 0) parts.push(`${totalOverdue} maintenance task${totalOverdue > 1 ? "s" : ""} need${totalOverdue === 1 ? "s" : ""} attention`);
  if (totalLowStock > 0) parts.push(`${totalLowStock} item${totalLowStock > 1 ? "s" : ""} below minimum stock`);
  return emailWrapper(
    companyName,
    `${companyName}: ${parts.join(" · ")}`,
    vessels.map(v => vesselBlock(v)).join(""),
    `You received this because email notifications are enabled for ${companyName}.`
  );
}

function buildVesselEmail(companyName: string, vessel: VesselAlertData): string {
  const parts: string[] = [];
  if (vessel.overdue.length > 0) parts.push(`${vessel.overdue.length} maintenance task${vessel.overdue.length > 1 ? "s" : ""} need${vessel.overdue.length === 1 ? "s" : ""} attention`);
  if (vessel.lowStock.length > 0) parts.push(`${vessel.lowStock.length} item${vessel.lowStock.length > 1 ? "s" : ""} below minimum stock`);
  return emailWrapper(
    companyName,
    `${vessel.vesselName}: ${parts.join(" · ")}`,
    vesselBlock(vessel),
    `You received this because you are registered as a notification contact for ${vessel.vesselName} (${companyName}).`
  );
}

function buildCompanyText(companyName: string, vessels: VesselAlertData[]): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let text = `Nautium - Daily Alert Summary\n${today}\n${companyName}\n${"=".repeat(50)}\n\n`;
  for (const v of vessels) {
    text += `VESSEL: ${v.vesselName}\n${"-".repeat(30)}\n`;
    if (v.overdue.length > 0) {
      text += `Maintenance Alerts (${v.overdue.length}):\n`;
      v.overdue.forEach(t => {
        text += `  - [${new Date(t.next_due_date) < new Date() ? "OVERDUE" : "DUE SOON"}] ${t.title} | Due: ${t.next_due_date} | Priority: ${t.priority}\n`;
      });
    }
    if (v.lowStock.length > 0) {
      text += `Low Stock (${v.lowStock.length}):\n`;
      v.lowStock.forEach(i => { text += `  - ${i.name} | Stock: ${i.current_stock} ${i.unit_of_measure} (min: ${i.minimum_stock})\n`; });
    }
    text += "\n";
  }
  text += "Log in to your Nautium dashboard to take action.\n";
  return text;
}

function buildVesselText(companyName: string, vessel: VesselAlertData): string {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  let text = `Nautium - Daily Alert Summary\n${today}\n${vessel.vesselName} (${companyName})\n${"=".repeat(50)}\n\n`;
  if (vessel.overdue.length > 0) {
    text += `Maintenance Alerts (${vessel.overdue.length}):\n`;
    vessel.overdue.forEach(t => {
      text += `  - [${new Date(t.next_due_date) < new Date() ? "OVERDUE" : "DUE SOON"}] ${t.title} | Due: ${t.next_due_date} | Priority: ${t.priority}\n`;
    });
    text += "\n";
  }
  if (vessel.lowStock.length > 0) {
    text += `Low Stock (${vessel.lowStock.length}):\n`;
    vessel.lowStock.forEach(i => { text += `  - ${i.name} | Stock: ${i.current_stock} ${i.unit_of_measure} (min: ${i.minimum_stock})\n`; });
    text += "\n";
  }
  text += "Log in to your Nautium dashboard to take action.\n";
  return text;
}
