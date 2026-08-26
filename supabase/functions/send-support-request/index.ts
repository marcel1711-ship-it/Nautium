import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPPORT_RECIPIENT = "hello@nautium.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userName, userEmail, companyName, vesselName, subject, message, priority } = await req.json();

    if (!userName || !userEmail || !message) {
      return new Response(
        JSON.stringify({ error: "userName, userEmail, and message are required" }),
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

    const priorityLabel = priority === 'urgent' ? '🔴 URGENT' : priority === 'high' ? '🟠 High' : '🟢 Normal';
    const subjectLine = subject
      ? `Support: ${subject} — ${companyName || userName}`
      : `Support request — ${companyName || userName}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #05111e; color: #e2e8f0; padding: 32px; border-radius: 12px;">
        <div style="border-bottom: 1px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="color: #22d3ee; font-size: 22px; margin: 0;">Support Request</h1>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0;">Nautium — In-App Support</p>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; width: 130px;">Priority</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">${priorityLabel}</td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Name</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">${userName}</td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Email</td>
            <td style="padding: 10px 0;">
              <a href="mailto:${userEmail}" style="color: #22d3ee; font-size: 14px; text-decoration: none;">${userEmail}</a>
            </td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Company</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px;">${companyName || 'N/A'}</td>
          </tr>
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Vessel</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px;">${vesselName || 'N/A'}</td>
          </tr>
          ${subject ? `
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Subject</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">${subject}</td>
          </tr>` : ''}
          <tr style="border-top: 1px solid #0f2744;">
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Message</td>
            <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</td>
          </tr>
        </table>

        <div style="margin-top: 28px; padding: 14px 18px; background: #0a1f36; border-radius: 8px; border-left: 3px solid #22d3ee;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Reply directly to <strong style="color: #94a3b8;">${userEmail}</strong> to respond to this support request.</p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nautium Support <hello@nautium.app>",
        to: [SUPPORT_RECIPIENT],
        reply_to: userEmail,
        subject: subjectLine,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to send support email", detail: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
