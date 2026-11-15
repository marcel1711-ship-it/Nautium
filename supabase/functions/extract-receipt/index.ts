import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      );
    }

    const { image_base64, media_type } = await req.json();

    if (!image_base64 || !media_type) {
      return new Response(
        JSON.stringify({ error: 'Missing image_base64 or media_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentBlock = media_type === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: image_base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type, data: image_base64 } };

    const isPdf = media_type === 'application/pdf';

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(isPdf ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `You are an expense receipt analyzer for a yacht management platform.

Extract the following fields from this receipt/invoice. Return ONLY a valid JSON object, no markdown, no backticks, no explanation.

Fields:
- amount: number (the total amount paid, no currency symbol)
- currency: string (3-letter ISO code: USD, EUR, GBP, etc. Default USD if unclear)
- description: string (short description of what was purchased/paid for, max 60 chars)
- vendor: string (business name on the receipt, or "" if unclear)
- expense_date: string (date in YYYY-MM-DD format, or "" if unclear)
- category: one of: mooring, electricity, water, internet, waste_disposal, port_fees, insurance, fuel, maintenance, provisions, crew_expenses, repairs, communications, entertainment, transport, other
- department: one of: Engineering, Deck, Interior, Galley, Safety, General (best guess based on the expense type)
- confidence: number 0-100 (how confident you are in the extraction overall)

If you cannot read the receipt clearly, still return the JSON with your best guesses and a low confidence score.

Example response:
{"amount":2850,"currency":"EUR","description":"Diesel refuel at Porto Cervo Marina","vendor":"Porto Cervo Marina","expense_date":"2026-11-01","category":"fuel","department":"Engineering","confidence":92}`,
            },
          ],
        }],
      }),
    });

    const anthropicData = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      return new Response(
        JSON.stringify({ error: anthropicData.error?.message || 'Anthropic API error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = anthropicData.content?.[0]?.text || '{}';
    let extracted = {};
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(clean);
    } catch {
      extracted = { error: 'Could not parse response', raw: text };
    }

    return new Response(
      JSON.stringify({ extracted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
