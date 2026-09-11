import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const API_KEY = Deno.env.get('TELEMETRY_API_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!API_KEY || token !== API_KEY) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { vessel_id, engines, batteries, tanks, gps, faults } = body;

    if (!vessel_id) {
      return new Response(JSON.stringify({ error: 'vessel_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: vessel, error: vesselErr } = await supabase
      .from('vessels')
      .select('id, company_id')
      .eq('id', vessel_id)
      .single();

    if (vesselErr || !vessel) {
      return new Response(JSON.stringify({ error: 'Vessel not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const company_id = vessel.company_id;
    const now = new Date().toISOString();
    const telemetryRows: any[] = [];
    const discoveredDevices: any[] = [];

    // --- Load existing mappings for this vessel ---
    const { data: existingMappings } = await supabase
      .from('nmea_device_mappings')
      .select('*')
      .eq('vessel_id', vessel_id);

    const mappingIndex = new Map<string, any>();
    for (const m of existingMappings || []) {
      mappingIndex.set(`${m.device_type}:${m.instance_key}`, m);
    }

    function getMapping(deviceType: string, instanceKey: string) {
      return mappingIndex.get(`${deviceType}:${instanceKey}`);
    }

    function addDiscovery(deviceType: string, instanceKey: string, pgn: number, label: string) {
      const key = `${deviceType}:${instanceKey}`;
      if (!mappingIndex.has(key)) {
        discoveredDevices.push({
          vessel_id,
          company_id,
          device_type: deviceType,
          instance_key: instanceKey,
          pgn,
          label,
          enabled: true,
          last_seen_at: now,
        });
        mappingIndex.set(key, { device_type: deviceType, instance_key: instanceKey });
      }
    }

    function addTelemetry(mapping: any, metric: string, value: number, unit: string) {
      if (!mapping || !mapping.enabled) return;
      telemetryRows.push({
        vessel_id,
        company_id,
        equipment_id: mapping.equipment_id || null,
        resource_id: mapping.resource_id || null,
        metric,
        value,
        unit,
        recorded_at: now,
      });
    }

    // --- Parse engines ---
    if (engines && typeof engines === 'object') {
      for (const [key, data] of Object.entries(engines)) {
        const eng = data as any;
        addDiscovery('engine', key, 127488, `Engine ${key}`);
        const mapping = getMapping('engine', key);
        if (mapping) {
          if (eng.rpm !== undefined) addTelemetry(mapping, 'rpm', eng.rpm, 'RPM');
          if (eng.temp !== undefined) addTelemetry(mapping, 'coolant_temp', eng.temp, '°C');
          if (eng.oil_pressure !== undefined) addTelemetry(mapping, 'oil_pressure', eng.oil_pressure, 'kPa');
          if (eng.hours !== undefined) addTelemetry(mapping, 'hours', eng.hours, 'h');
          if (eng.gear !== undefined) addTelemetry(mapping, 'gear', eng.gear, '');
        }
      }
    }

    // --- Parse batteries ---
    if (batteries && typeof batteries === 'object') {
      for (const [key, data] of Object.entries(batteries)) {
        const bat = data as any;
        addDiscovery('battery', key, 127508, `Battery ${key}`);
        const mapping = getMapping('battery', key);
        if (mapping) {
          if (bat.voltage !== undefined) addTelemetry(mapping, 'voltage', bat.voltage, 'V');
          if (bat.current !== undefined) addTelemetry(mapping, 'current', bat.current, 'A');
          if (bat.soc !== undefined) addTelemetry(mapping, 'soc', bat.soc, '%');
          if (bat.temp !== undefined) addTelemetry(mapping, 'temperature', bat.temp, '°C');
        }
      }
    }

    // --- Parse tanks ---
    if (tanks && Array.isArray(tanks)) {
      for (const tank of tanks) {
        const instanceKey = `tank_${tank.instance}`;
        const tankType = tank.type !== undefined ? `Tank ${tank.type}` : `Tank ${tank.instance}`;
        addDiscovery('tank', instanceKey, 127505, tankType);
        const mapping = getMapping('tank', instanceKey);
        if (mapping) {
          if (tank.level !== undefined) addTelemetry(mapping, 'level', tank.level, '%');
          if (tank.capacity !== undefined) addTelemetry(mapping, 'capacity', tank.capacity, 'L');
        }
      }
    }

    // --- Parse GPS ---
    if (gps && typeof gps === 'object') {
      addDiscovery('gps', 'gps_0', 129025, 'GPS');
      const mapping = getMapping('gps', 'gps_0');
      if (mapping) {
        if (gps.lat !== undefined) addTelemetry(mapping, 'latitude', gps.lat, '°');
        if (gps.lon !== undefined) addTelemetry(mapping, 'longitude', gps.lon, '°');
        if (gps.sog !== undefined) addTelemetry(mapping, 'sog', gps.sog, 'kn');
        if (gps.cog !== undefined) addTelemetry(mapping, 'cog', gps.cog, '°');
      }
    }

    // --- Auto-discover new devices ---
    if (discoveredDevices.length > 0) {
      await supabase
        .from('nmea_device_mappings')
        .upsert(discoveredDevices, { onConflict: 'vessel_id,device_type,instance_key' });
    }

    // --- Update last_seen_at for known devices ---
    const seenKeys = new Set<string>();
    if (engines) Object.keys(engines).forEach(k => seenKeys.add(`engine:${k}`));
    if (batteries) Object.keys(batteries).forEach(k => seenKeys.add(`battery:${k}`));
    if (tanks) (tanks as any[]).forEach(t => seenKeys.add(`tank:tank_${t.instance}`));
    if (gps) seenKeys.add('gps:gps_0');

    for (const key of seenKeys) {
      const existing = existingMappings?.find(
        m => `${m.device_type}:${m.instance_key}` === key
      );
      if (existing) {
        await supabase
          .from('nmea_device_mappings')
          .update({ last_seen_at: now })
          .eq('id', existing.id);
      }
    }

    // --- Insert telemetry (only for mapped+enabled devices) ---
    let inserted = 0;
    const mappedRows = telemetryRows.filter(r => r.equipment_id || r.resource_id);
    if (mappedRows.length > 0) {
      const { error: insertErr } = await supabase.from('vessel_telemetry').insert(mappedRows);
      if (insertErr) throw insertErr;
      inserted = mappedRows.length;

      // Update equipment_hours
      const hoursRows = mappedRows.filter(r => r.metric === 'hours' && r.equipment_id);
      for (const hr of hoursRows) {
        await supabase.from('equipment').update({ equipment_hours: hr.value }).eq('id', hr.equipment_id);
      }

      // Update fuel_resources current_level
      const levelRows = mappedRows.filter(r => r.metric === 'level' && r.resource_id);
      for (const lr of levelRows) {
        const { data: resource } = await supabase
          .from('fuel_resources')
          .select('capacity')
          .eq('id', lr.resource_id)
          .single();
        if (resource) {
          const currentLevel = Math.round((lr.value / 100) * Number(resource.capacity));
          await supabase.from('fuel_resources').update({ current_level: currentLevel }).eq('id', lr.resource_id);
        }
      }
    }

    // --- Store faults as telemetry too ---
    if (faults && Array.isArray(faults) && faults.length > 0) {
      const faultRows = faults.map((f: any) => ({
        vessel_id,
        company_id,
        equipment_id: null,
        resource_id: null,
        metric: 'fault',
        value: f.spn,
        unit: `FMI:${f.fmi}`,
        recorded_at: now,
      }));
      await supabase.from('vessel_telemetry').insert(faultRows);
      inserted += faultRows.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inserted,
        discovered: discoveredDevices.length,
        unmapped: telemetryRows.length - mappedRows.length,
        timestamp: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('ingest-connect error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
