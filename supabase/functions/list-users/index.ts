import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRole = requestingUser.app_metadata?.role ?? requestingUser.user_metadata?.role;
    if (userRole !== 'master_admin' && userRole !== 'customer_admin') {
      return new Response(JSON.stringify({ error: 'Only admins can list users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let company_id: string | null = null;
    try {
      const body = await req.json();
      company_id = body.company_id ?? null;
    } catch {
      company_id = null;
    }

    // Query auth.users directly via SQL using service role (avoids listUsers() permission issues)
    const { data: usersData, error: queryError } = await supabaseAdmin
      .rpc('get_all_users_for_admin');

    if (queryError) {
      // Fallback: query auth.users directly
      const dbUrl = Deno.env.get('SUPABASE_DB_URL') ?? '';
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let users = (usersData ?? []) as any[];

    // Filter out master_admin
    let filteredUsers = users.filter((u: any) => u.role !== 'master_admin');

    const requestingUserCompanyId = requestingUser.app_metadata?.company_id ?? requestingUser.user_metadata?.company_id;

    if (userRole === 'customer_admin') {
      // customer_admin can ONLY see their own company — ignore client-supplied company_id
      filteredUsers = filteredUsers.filter((u: any) => u.company_id === requestingUserCompanyId);
    } else if (company_id) {
      // master_admin can filter by any company
      filteredUsers = filteredUsers.filter((u: any) => u.company_id === company_id);
    }

    // Shape into the format the frontend expects
    const shaped = filteredUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      user_metadata: {
        role: u.role,
        company_id: u.company_id,
        company_name: u.company_name,
        full_name: u.full_name,
        vessel_ids: u.vessel_ids ?? [],
      },
    }));

    return new Response(JSON.stringify({ success: true, users: shaped }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error listing users:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
