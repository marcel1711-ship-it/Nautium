import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  company_id: string;
  company_name: string;
  full_name: string;
  role?: 'customer_admin' | 'standard_user';
  vessel_ids?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userRole = requestingUser.app_metadata?.role ?? requestingUser.user_metadata?.role;
    if (userRole !== 'master_admin' && userRole !== 'customer_admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can create users' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, password, company_id, company_name, full_name, role, vessel_ids }: CreateUserRequest = await req.json();

    if (!email || !password || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, company_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requesterCompanyId = requestingUser.app_metadata?.company_id ?? requestingUser.user_metadata?.company_id;
    if (userRole === 'customer_admin' && requesterCompanyId !== company_id) {
      return new Response(
        JSON.stringify({ error: 'Customer admins can only create users for their own company' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const metaPayload = {
      role: role || 'customer_admin',
      company_id,
      company_name,
      full_name,
      vessel_ids: vessel_ids || [],
    };

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metaPayload,
      app_metadata: metaPayload,
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert real notification for master admin
    await supabaseAdmin.from('admin_notifications').insert({
      type: 'new_user',
      title: 'New user created',
      message: `User "${full_name || email}" was added to "${company_name}".`,
      metadata: {
        user_id: newUser.user?.id,
        user_email: email,
        user_name: full_name,
        company_id,
        company_name,
        role: role || 'customer_admin',
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
