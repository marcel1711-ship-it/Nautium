import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ALLOWED_TABLES = [
  'companies',
  'vessels',
  'equipment',
  'maintenance_tasks',
  'maintenance_history',
  'inventory_items',
  'stock_movements',
  'maintenance_manuals',
  'fuel_resources',
  'fuel_log',
  'operational_expenses',
  'customers',
  'master_admin_notifications',
  'water_toys',
  'voyages',
  'voyage_guests',
  'compliance_items',
  'crew_members',
  'purchase_requests',
  'push_subscriptions',
  'vessel_telemetry',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // --- AUTH: validate caller's JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRole = user.app_metadata?.role ?? user.user_metadata?.role;
    const userCompanyId = user.app_metadata?.company_id ?? user.user_metadata?.company_id;
    const isMasterAdmin = userRole === 'master_admin';

    // --- Parse request ---
    const body = await req.json();
    const { action, table, company_id, data, id, filters } = body;

    if (!table) {
      return new Response(JSON.stringify({ error: 'table required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- TABLE WHITELIST ---
    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: 'Table not allowed' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- TENANCY CHECK for company-scoped actions ---
    if (company_id && !isMasterAdmin && company_id !== userCompanyId) {
      return new Response(JSON.stringify({ error: 'Access denied: company mismatch' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SELECT by company_id
    if (!action || action === 'select') {
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id required for select' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let query = supabase.from(table).select('*').eq('company_id', company_id);
      if (filters?.order_by) {
        query = query.order(filters.order_by, { ascending: filters.ascending ?? true });
      }
      const { data: rows, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ data: rows }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SELECT by vessel_id with optional date range
    if (action === 'select_by_vessel') {
      const { vessel_id, date_field, date_from, date_to, extra_filters, order_by, ascending, limit: lim, select_cols } = body;
      if (!vessel_id) throw new Error('vessel_id required for select_by_vessel');

      // Validate vessel belongs to user's company (non-master_admin)
      if (!isMasterAdmin) {
        const userVesselIds: string[] = user.app_metadata?.vessel_ids ?? user.user_metadata?.vessel_ids ?? [];
        const isAdmin = userRole === 'customer_admin' || userRole === 'owner';
        if (!isAdmin && userVesselIds.length > 0 && !userVesselIds.includes(vessel_id)) {
          return new Response(JSON.stringify({ error: 'Access denied: vessel not assigned' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      let query = supabase.from(table).select(select_cols || '*').eq('vessel_id', vessel_id);
      if (date_field && date_from) query = query.gte(date_field, date_from);
      if (date_field && date_to) query = query.lte(date_field, date_to);
      if (extra_filters) {
        for (const [k, v] of Object.entries(extra_filters)) {
          query = (query as any).eq(k, v);
        }
      }
      if (order_by) query = query.order(order_by, { ascending: ascending ?? false });
      if (lim) query = query.limit(lim);
      const { data: rows, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ data: rows }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- TENANT ISOLATION: verify record belongs to user's company ---
    const enforceCompany = !isMasterAdmin ? userCompanyId : null;

    const verifyOwnership = async (recordId: string): Promise<boolean> => {
      if (!enforceCompany) return true;
      const { data: row } = await supabase.from(table).select('company_id').eq('id', recordId).single();
      return row?.company_id === enforceCompany;
    };

    // INSERT
    if (action === 'insert') {
      if (enforceCompany) {
        const insertData = Array.isArray(data) ? data : [data];
        for (const row of insertData) {
          if (row.company_id && row.company_id !== enforceCompany) {
            return new Response(JSON.stringify({ error: 'Access denied: cannot insert data for another company' }), {
              status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          row.company_id = row.company_id || enforceCompany;
        }
      }
      const { data: row, error } = await supabase.from(table).insert(data).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data: row }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE
    if (action === 'update') {
      if (!id) throw new Error('id required for update');
      if (enforceCompany && !(await verifyOwnership(id))) {
        return new Response(JSON.stringify({ error: 'Access denied: record belongs to another company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (enforceCompany && data?.company_id && data.company_id !== enforceCompany) {
        return new Response(JSON.stringify({ error: 'Access denied: cannot reassign record to another company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: row, error } = await supabase.from(table).update(data).eq('id', id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data: row }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE
    if (action === 'delete') {
      if (!id) throw new Error('id required for delete');
      if (enforceCompany && !(await verifyOwnership(id))) {
        return new Response(JSON.stringify({ error: 'Access denied: record belongs to another company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE WHERE (scoped to company)
    if (action === 'delete_where') {
      const { field, value } = body;
      if (!field || !value) throw new Error('field and value required for delete_where');
      if (enforceCompany) {
        const { error } = await supabase.from(table).delete().eq(field, value).eq('company_id', enforceCompany);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).delete().eq(field, value);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
