import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

const API_KEY = Deno.env.get('TELEMETRY_API_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('X-Api-Key') || '';
    if (!API_KEY || apiKey !== API_KEY) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { vessel_id, company_id, readings } = body;

    if (!vessel_id || !company_id || !readings || !Array.isArray(readings) || readings.length === 0) {
      return new Response(JSON.stringify({ error: 'vessel_id, company_id, and readings[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (readings.length > 100) {
      return new Response(JSON.stringify({ error: 'Max 100 readings per batch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const rows = readings.map((r: any) => ({
      vessel_id,
      company_id,
      equipment_id: r.equipment_id || null,
      resource_id: r.resource_id || null,
      metric: r.metric,
      value: r.value,
      unit: r.unit || '',
      recorded_at: r.recorded_at || now,
    }));

    const { error } = await supabase.from('vessel_telemetry').insert(rows);
    if (error) throw error;

    // Update equipment_hours on equipment table for 'hours' metrics
    const hoursReadings = readings.filter((r: any) => r.metric === 'hours' && r.equipment_id);
    for (const hr of hoursReadings) {
      await supabase.from('equipment').update({ equipment_hours: hr.value }).eq('id', hr.equipment_id);
    }

    // Update current_level on fuel_resources for 'level' metrics
    const levelReadings = readings.filter((r: any) => r.metric === 'level' && r.resource_id);
    for (const lr of levelReadings) {
      const resource = await supabase.from('fuel_resources').select('capacity').eq('id', lr.resource_id).single();
      if (resource.data) {
        const currentLevel = Math.round((lr.value / 100) * Number(resource.data.capacity));
        await supabase.from('fuel_resources').update({ current_level: currentLevel }).eq('id', lr.resource_id);
      }
    }

    return new Response(
      JSON.stringify({ inserted: rows.length, timestamp: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('ingest-telemetry error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
