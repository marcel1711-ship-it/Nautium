import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_USERS = [
  {
    email: "marco@ninemoon.com",
    user_metadata: {
      full_name: "Marco Bellini",
      role: "customer_admin",
      company_id: "10000010-0000-0000-0000-000000000000",
      vessel_ids: [
        "20000001-0000-0000-0000-000000000000",
        "20000002-0000-0000-0000-000000000000",
        "20000003-0000-0000-0000-000000000000",
      ],
    },
  },
  {
    email: "captain@ninemoon.com",
    user_metadata: {
      full_name: "Luca Ferrari",
      role: "standard_user",
      company_id: "10000010-0000-0000-0000-000000000000",
      vessel_ids: ["20000001-0000-0000-0000-000000000000"],
    },
  },
  {
    email: "sophie@rivierafleet.com",
    user_metadata: {
      full_name: "Sophie Laurent",
      role: "customer_admin",
      company_id: "10000020-0000-0000-0000-000000000000",
      vessel_ids: [
        "20000004-0000-0000-0000-000000000000",
        "20000005-0000-0000-0000-000000000000",
      ],
    },
  },
  {
    email: "engineer@rivierafleet.com",
    user_metadata: {
      full_name: "Pierre Dupont",
      role: "standard_user",
      company_id: "10000020-0000-0000-0000-000000000000",
      vessel_ids: ["20000004-0000-0000-0000-000000000000"],
    },
  },
  {
    email: "james@bluehorizon.io",
    user_metadata: {
      full_name: "James Harrington",
      role: "customer_admin",
      company_id: "10000030-0000-0000-0000-000000000000",
      vessel_ids: ["20000006-0000-0000-0000-000000000000"],
    },
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- AUTH: only master_admin can reset demo passwords ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRole = requestingUser.app_metadata?.role ?? requestingUser.user_metadata?.role;
    if (callerRole !== "master_admin") {
      return new Response(JSON.stringify({ error: "Only master_admin can reset demo passwords" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const demo of DEMO_USERS) {
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existing = allUsers?.users?.find(u => u.email === demo.email);

      if (existing) {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: "demo123",
          email_confirm: true,
          user_metadata: demo.user_metadata,
          app_metadata: demo.user_metadata,
        });
        if (error) {
          results.push({ email: demo.email, success: false, error: error.message });
        } else {
          results.push({ email: demo.email, success: true, action: "updated", id: data.user?.id });
        }
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: demo.email,
          password: "demo123",
          email_confirm: true,
          user_metadata: demo.user_metadata,
          app_metadata: demo.user_metadata,
        });
        if (error) {
          results.push({ email: demo.email, success: false, error: error.message });
        } else {
          results.push({ email: demo.email, success: true, action: "created", id: data.user?.id });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
