import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_RECIPIENT = "hello@nautium.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { name, email, fleet, message, lang } = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "name and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fleetLabel = fleet || "No especificado";
    const messageBody = message || "Sin mensaje adicional";

    // ── Internal notification email (to hello@nautium.app) ──
    const internalHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #05111e; color: #e2e8f0; padding: 32px; border-radius: 12px;">
        <div style="border-bottom: 1px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="color: #22d3ee; font-size: 22px; margin: 0;">Nueva solicitud de demo</h1>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0;">Nautium — Landing Page</p>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; width: 130px;">Nombre</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">${name}</td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Email</td>
            <td style="padding: 10px 0;">
              <a href="mailto:${email}" style="color: #22d3ee; font-size: 14px; text-decoration: none;">${email}</a>
            </td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Tipo de flota</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px;">${fleetLabel}</td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Mensaje</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; line-height: 1.6;">${messageBody}</td>
          </tr>
        </table>

        <div style="margin-top: 28px; padding: 14px 18px; background: #0a1f36; border-radius: 8px; border-left: 3px solid #22d3ee;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Responde directamente a <strong style="color: #94a3b8;">${email}</strong> para contactar al prospecto.</p>
        </div>
      </div>
    `;

    // ── Confirmation email (to requester) — bilingual ──
    const confirmationHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #05111e; color: #e2e8f0; padding: 40px 32px; border-radius: 12px;">

        <!-- Logo -->
        <div style="margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #1e3a5f;">
          <div style="display: inline-flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #38bdf8, #0284c7); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 18px; font-weight: bold;">⚓</span>
            </div>
            <span style="font-size: 20px; font-weight: 700; color: #ffffff;">Nau<span style="color: #22d3ee;">tium</span></span>
          </div>
        </div>

        <!-- English section -->
        <div style="margin-bottom: 36px; padding-bottom: 36px; border-bottom: 1px solid #1e3a5f;">
          <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; margin: 0 0 20px 0;">English</p>

          <p style="color: #e2e8f0; font-size: 15px; margin: 0 0 14px 0;">Hi ${name},</p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 14px 0;">
            Thanks for reaching out and requesting a demo of <strong style="color: #22d3ee;">Nautium</strong>.
          </p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 14px 0;">
            We received your request successfully and will get back to you shortly to schedule a personalized walkthrough.
          </p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
            In the meantime, we're excited to show you how Nautium helps yacht owners and crews manage maintenance, inventory and operational costs in one place.
          </p>

          <p style="color: #e2e8f0; font-size: 14px; margin: 0;">Best regards,<br/><strong style="color: #22d3ee;">Nautium</strong></p>
        </div>

        <!-- Spanish section -->
        <div style="margin-bottom: 36px;">
          <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; margin: 0 0 20px 0;">Español</p>

          <p style="color: #e2e8f0; font-size: 15px; margin: 0 0 14px 0;">Hola ${name},</p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 14px 0;">
            Gracias por ponerte en contacto y solicitar una demo de <strong style="color: #22d3ee;">Nautium</strong>.
          </p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 14px 0;">
            Hemos recibido tu solicitud correctamente y nos pondremos en contacto contigo en breve para programar una sesión personalizada.
          </p>

          <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
            Mientras tanto, estamos deseando mostrarte cómo Nautium ayuda a propietarios de yates y tripulaciones a gestionar el mantenimiento, el inventario y los costes operativos en un solo lugar.
          </p>

          <p style="color: #e2e8f0; font-size: 14px; margin: 0;">Un cordial saludo,<br/><strong style="color: #22d3ee;">Nautium</strong></p>
        </div>

        <!-- Footer -->
        <div style="padding-top: 24px; border-top: 1px solid #1e3a5f;">
          <p style="color: #334155; font-size: 11px; margin: 0; text-align: center;">
            &copy; ${new Date().getFullYear()} Nautium &middot; Monaco &middot; Fort Lauderdale &middot; Palma de Mallorca
          </p>
        </div>
      </div>
    `;

    // Send both emails in parallel
    const [internalRes, confirmRes] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Nautium <hello@nautium.app>",
          to: [DEMO_RECIPIENT],
          reply_to: email,
          subject: `Demo request — ${name}`,
          html: internalHtml,
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Nautium <hello@nautium.app>",
          to: [email],
          subject: "Demo request received / Solicitud de demo recibida — Nautium",
          html: confirmationHtml,
        }),
      }),
    ]);

    if (!internalRes.ok) {
      const err = await internalRes.text();
      console.error("Resend error (internal):", err);
      return new Response(
        JSON.stringify({ error: "Failed to send internal email", detail: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!confirmRes.ok) {
      const err = await confirmRes.text();
      console.error("Resend error (confirmation):", err);
      // Don't fail the request — internal email was sent, confirmation is best-effort
      console.warn("Confirmation email failed but internal notification was sent.");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
