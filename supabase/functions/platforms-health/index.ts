import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Public health pinger — no auth required
async function pingOne(url: string, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    return { url, ok: res.ok, status: res.status, latencyMs: Date.now() - started };
  } catch (e: any) {
    return { url, ok: false, status: 0, latencyMs: Date.now() - started, error: String(e?.message ?? e) };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targets: { key: string; url: string }[] = Array.isArray(body.targets) && body.targets.length
      ? body.targets
      : [
          { key: 'funRich', url: 'https://fun.rich' },
          { key: 'loveHub', url: 'https://lovehub.fun.rich' },
          { key: 'academy', url: 'https://academy.fun.rich' },
          { key: 'farm', url: 'https://farm.fun.rich' },
          { key: 'charity', url: 'https://charity.fun.rich' },
        ];
    const results = await Promise.all(
      targets.map(async (t) => ({ key: t.key, ...(await pingOne(t.url)) }))
    );
    return new Response(JSON.stringify({ checkedAt: new Date().toISOString(), results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
