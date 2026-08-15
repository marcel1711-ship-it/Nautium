import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- AUTH: require authenticated user ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { pdf_url, extract_type } = await req.json()

    if (!pdf_url || !extract_type) {
      return new Response(
        JSON.stringify({ error: 'Missing pdf_url or extract_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- URL RESTRICTION: only allow Supabase Storage URLs ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (!pdf_url.startsWith(supabaseUrl)) {
      return new Response(
        JSON.stringify({ error: 'Only files from Supabase Storage are allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch PDF and convert to base64
    const pdfResponse = await fetch(pdf_url)
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

    const today = new Date().toISOString().split('T')[0]

    const prompt = extract_type === 'maintenance'
      ? `You are a marine engineer expert analyzing a vessel technical manual.

STEP 1 - Find the maintenance schedule section:
Look in the table of contents for sections titled "Inspection and Maintenance Schedule", "Maintenance Schedule", "Service Schedule", "Scheduled Maintenance", "Programas de Mantenimiento", or similar. Navigate to those pages.

STEP 2 - Extract ALL maintenance tasks from those sections.
Look for intervals like:
- "Before each use" / "Daily" / "Antes de cada uso"
- "After each use" / "Despues de cada uso"
- "Every X hours" / "Cada X horas"
- "Annual" / "Yearly" / "Once a year" / "Anual"
- "Every X years" / "Cada X anos"
- "Monthly" / "Quarterly" / "Semi-annual"

For each task return a JSON object with:
- title: short task name (e.g. "Engine oil change")
- description: what needs to be done, include specs, torque values, part numbers if mentioned
- category: one of (Engine Maintenance, Cooling System, Electrical, Navigation, Safety, Hydraulic, Fuel System, Hull & Deck, Other)
- priority: critical (safety-related or engine damage risk), high (engine/drivetrain), medium (regular service), low (cosmetic/optional)
- interval_days: convert to days:
  * Before/after each use = 1
  * Every 50 hours = 50
  * Every 100 hours OR annual/yearly = 365
  * Every 200 hours = 200
  * Every 300 hours OR 3 years = 1095
  * Monthly = 30, Quarterly = 90, Semi-annual = 180
- next_due_date: ${today} plus interval_days in YYYY-MM-DD format
- equipment_name: the equipment name from the manual title or cover page

IMPORTANT:
- Include ALL tasks from maintenance schedule, even simple visual inspections
- Do NOT include operating procedures, troubleshooting, or one-time installation steps
- Return ONLY a valid JSON array, no markdown, no backticks, no explanation`

      : `You are a marine engineer expert analyzing a vessel technical manual.

STEP 1 - Find the equipment/systems section in the table of contents.

STEP 2 - Extract ALL physical equipment items from the manual.
For each equipment item return a JSON object with:
- name: full equipment name (e.g. "Mercury Verado L6 350hp")
- type: one of (Engine, Generator, Pump, Navigation, Electrical, Safety, HVAC, Hydraulic, Other)
- manufacturer: brand/manufacturer name
- model: model number or name
- quantity: number of units (use 2 for port/starboard pairs, otherwise 1)
- location: where on vessel (Engine Room, Bridge, Deck, etc.)
- specifications: key specs as short string

IMPORTANT:
- Only include physical equipment items, not procedures or checklists
- For paired items (port/starboard) set quantity to 2
- Return ONLY a valid JSON array, no markdown, no backticks, no explanation`

    // Call Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
      }),
    })

    const anthropicData = await anthropicResponse.json()

    if (!anthropicResponse.ok) {
      return new Response(
        JSON.stringify({ error: anthropicData.error?.message || 'Anthropic API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const text = anthropicData.content?.[0]?.text || '[]'
    let items = []
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      items = JSON.parse(clean)
    } catch {
      items = []
    }

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
