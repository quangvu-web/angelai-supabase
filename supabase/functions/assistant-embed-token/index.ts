// Issues a short-lived embed JWT for whitelisted clients to use in /embed/chat.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const JWT_SECRET = Deno.env.get("ASSISTANT_EMBED_JWT_SECRET");
const TTL_SECONDS = 60 * 15;

// in-memory rate limiter (30 req / 5 min / IP)
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 5 * 60_000 });
    return true;
  }
  if (b.count >= 30) return false;
  b.count++;
  return true;
}

async function sign(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!JWT_SECRET) {
    return new Response(JSON.stringify({ error: "secret_not_configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { client_id?: string; origin?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const client_id = (body.client_id ?? "").trim();
  const origin = (body.origin ?? req.headers.get("origin") ?? "").trim();
  if (!client_id || !origin) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: client, error } = await admin
    .from("assistant_embed_clients")
    .select("client_id, allowed_origins, scopes, active")
    .eq("client_id", client_id)
    .maybeSingle();

  let status = "ok";
  let token: string | null = null;

  if (error || !client || !client.active || !client.allowed_origins?.includes(origin)) {
    status = !client ? "unknown_client" : !client.active ? "inactive" : "origin_not_allowed";
  } else {
    const now = Math.floor(Date.now() / 1000);
    token = await sign({
      client_id: client.client_id,
      scopes: client.scopes,
      origin,
      iat: now,
      exp: now + TTL_SECONDS,
    }, JWT_SECRET);
  }

  // background audit (don't block)
  admin.from("assistant_embed_token_audit").insert({
    client_id, origin, ip, user_agent: req.headers.get("user-agent"), status,
  }).then(() => {});

  if (!token) {
    return new Response(JSON.stringify({ error: status }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ token, expires_in: TTL_SECONDS }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
