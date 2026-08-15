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

    const userRole = requestingUser.app_metadata?.role || requestingUser.user_metadata?.role;
    if (userRole !== 'master_admin') {
      return new Response(JSON.stringify({ error: 'Only master admins can delete companies' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: company_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List all auth users and find those belonging to this company
    let page = 1;
    const perPage = 1000;
    const usersToDelete: string[] = [];

    while (true) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        console.error('Error listing users:', listError);
        break;
      }

      for (const u of users) {
        const uCompany = u.app_metadata?.company_id ?? u.user_metadata?.company_id;
        if (uCompany === company_id) {
          usersToDelete.push(u.id);
        }
      }

      if (users.length < perPage) break;
      page++;
    }

    // Delete all auth users belonging to this company
    for (const userId of usersToDelete) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError) {
        console.error(`Failed to delete auth user ${userId}:`, deleteUserError);
      }
    }

    // Delete the company record (cascade deletes vessels, equipment, etc.)
    const { error: deleteCompanyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', company_id);

    if (deleteCompanyError) {
      return new Response(JSON.stringify({ error: deleteCompanyError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, deleted_users: usersToDelete.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error deleting company:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
