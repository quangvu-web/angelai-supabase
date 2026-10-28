import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize identity payload to handle different response shapes
function normalizeIdentity(raw: Record<string, unknown>) {
  const r = raw as any;

  const email =
    r.email ||
    r.user?.email ||
    r.profile?.email ||
    r.data?.email ||
    r.token_info?.email ||
    null;

  const funUserId =
    r.sub ||
    r.fun_id ||
    r.user?.id ||
    r.user?.sub ||
    r.data?.sub ||
    null;

  const displayName =
    r.username ||
    r.display_name ||
    r.full_name ||
    r.name ||
    r.user?.username ||
    r.user?.display_name ||
    r.user?.full_name ||
    r.profile?.display_name ||
    (typeof email === "string" ? email.split("@")[0] : null);

  const avatarUrl =
    r.avatar_url ||
    r.user?.avatar_url ||
    r.profile?.avatar_url ||
    null;

  return { email, funUserId, displayName, avatarUrl };
}

// SHA-256 hash for token (replay detection + audit, never log raw token)
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Decode JWT payload safely (verification was already done by FUN sso-verify)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Capture client metadata for audit
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  // Initialize Supabase Admin client (also used for audit logging)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Audit helper — fire-and-forget; never block response on audit failure
  const audit = async (params: {
    success: boolean;
    failureReason?: string | null;
    funUserId?: string | null;
    email?: string | null;
    angelUserId?: string | null;
    tokenHash?: string | null;
  }) => {
    try {
      await supabase.from("bridge_login_audit").insert({
        ip_address: ipAddress,
        user_agent: userAgent,
        fun_user_id: params.funUserId ?? null,
        email: params.email ?? null,
        angel_user_id: params.angelUserId ?? null,
        success: params.success,
        failure_reason: params.failureReason ?? null,
        token_hash: params.tokenHash ?? null,
      });
    } catch (e) {
      console.error("[bridge-login] audit insert failed:", e);
    }
  };

  let tokenHash: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const fun_access_token = body?.fun_access_token;

    if (!fun_access_token || typeof fun_access_token !== "string") {
      await audit({ success: false, failureReason: "missing_token" });
      return new Response(
        JSON.stringify({ error: "Missing fun_access_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    tokenHash = await sha256Hex(fun_access_token);

    // === RATE LIMIT: max 10 attempts per IP per 5 minutes ===
    if (ipAddress) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count: ipCount } = await supabase
        .from("bridge_login_audit")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", fiveMinAgo);

      if ((ipCount ?? 0) >= 10) {
        await audit({ success: false, failureReason: "rate_limit_ip", tokenHash });
        return new Response(
          JSON.stringify({ error: "Too many attempts. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // === REPLAY PROTECTION: same token used > 3 times in last 5 min = suspicious ===
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: tokenCount } = await supabase
      .from("bridge_login_audit")
      .select("*", { count: "exact", head: true })
      .eq("token_hash", tokenHash)
      .gte("created_at", fiveMinAgo);

    if ((tokenCount ?? 0) >= 3) {
      await audit({ success: false, failureReason: "token_replay", tokenHash });
      return new Response(
        JSON.stringify({ error: "Token reuse detected" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === 1. Verify token with FUN Profile sso-verify (REQUIRED) ===
    const funApiUrl = Deno.env.get("FUN_PROFILE_API_URL");
    if (!funApiUrl) {
      console.error("FUN_PROFILE_API_URL not configured");
      await audit({ success: false, failureReason: "sso_not_configured", tokenHash });
      return new Response(
        JSON.stringify({ error: "SSO not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyRes = await fetch(`${funApiUrl}/sso-verify`, {
      method: "GET",
      headers: { Authorization: `Bearer ${fun_access_token}` },
    });

    if (!verifyRes.ok) {
      const errText = await verifyRes.text().catch(() => "Unknown error");
      console.error("SSO verify failed:", verifyRes.status, errText);
      await audit({ success: false, failureReason: `sso_verify_failed_${verifyRes.status}`, tokenHash });
      return new Response(
        JSON.stringify({ error: "Token verification failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawIdentity = await verifyRes.json();

    // 2. Normalize identity from VERIFIED source only
    const normalized = normalizeIdentity(rawIdentity);

    // 3. Fallback to JWT payload (signature already trusted via sso-verify above)
    if (!normalized.email) {
      const payload = decodeJwtPayload(fun_access_token);
      if (payload?.email && typeof payload.email === "string") {
        normalized.email = payload.email;
      }
      if (!normalized.funUserId && payload?.sub && typeof payload.sub === "string") {
        normalized.funUserId = payload.sub;
      }
    }

    // 🚨 CRITICAL: NEVER trust hint_email from client.
    // Email MUST come from FUN Profile sso-verify response or from the verified JWT payload.
    // (Previous code accepted hint_email from request body — this allowed account takeover.)

    if (!normalized.email) {
      await audit({ success: false, failureReason: "missing_email_in_identity", tokenHash, funUserId: normalized.funUserId });
      return new Response(
        JSON.stringify({ error: "Identity payload missing email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!normalized.funUserId) {
      await audit({ success: false, failureReason: "missing_fun_user_id", tokenHash, email: normalized.email });
      return new Response(
        JSON.stringify({ error: "Identity payload missing FUN user ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === 4. CROSS-CHECK: ensure this fun_user_id is not already linked to a DIFFERENT angel account ===
    const { data: existingLink } = await supabase
      .from("fun_id_links")
      .select("angel_user_id, status")
      .eq("fun_profile_user_id", normalized.funUserId)
      .maybeSingle();

    // Helper: paginated user lookup by email
    async function findUserByEmail(email: string) {
      const target = email.toLowerCase();
      let page = 1;
      const perPage = 100;
      while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) {
          console.error("[bridge-login] listUsers error page", page, error.message);
          return null;
        }
        const match = data.users.find((u: any) => u.email?.toLowerCase() === target);
        if (match) return match;
        if (data.users.length < perPage) break;
        page++;
      }
      return null;
    }

    // 5. Find or create user by email
    let userId: string;
    const existingUser = await findUserByEmail(normalized.email);

    if (existingUser) {
      userId = existingUser.id;

      // 🚨 CRITICAL CROSS-CHECK: if this fun_user_id is already linked to a DIFFERENT user, REJECT
      if (existingLink && existingLink.angel_user_id !== userId) {
        console.error("[bridge-login] FUN user ID already linked to different account");
        await audit({
          success: false,
          failureReason: "fun_id_conflict",
          tokenHash,
          email: normalized.email,
          funUserId: normalized.funUserId,
          angelUserId: userId,
        });
        return new Response(
          JSON.stringify({ error: "This FUN account is already linked to another Angel AI account." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // No existing email → if fun_user_id is already linked elsewhere, REJECT
      if (existingLink) {
        await audit({
          success: false,
          failureReason: "fun_id_already_linked_other_email",
          tokenHash,
          email: normalized.email,
          funUserId: normalized.funUserId,
        });
        return new Response(
          JSON.stringify({ error: "This FUN account is already linked to another Angel AI account." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: normalized.email,
        email_confirm: true,
        user_metadata: {
          display_name: normalized.displayName,
          avatar_url: normalized.avatarUrl,
          source: "fun_profile_sso",
        },
      });

      if (createError) {
        if (createError.message?.toLowerCase().includes("email") ||
            (createError as any).code === "email_exists") {
          const recovered = await findUserByEmail(normalized.email);
          if (recovered) {
            userId = recovered.id;
          } else {
            await audit({ success: false, failureReason: "user_resolve_failed", tokenHash, email: normalized.email, funUserId: normalized.funUserId });
            return new Response(
              JSON.stringify({ error: "Failed to resolve user account" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          console.error("Failed to create user:", createError);
          await audit({ success: false, failureReason: "user_create_failed", tokenHash, email: normalized.email, funUserId: normalized.funUserId });
          return new Response(
            JSON.stringify({ error: "Failed to create user account" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (!newUser.user) {
        await audit({ success: false, failureReason: "user_create_no_user", tokenHash, email: normalized.email, funUserId: normalized.funUserId });
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        userId = newUser.user.id;
      }
    }

    // 6. Upsert fun_id_links (now safe — cross-check passed)
    await supabase
      .from("fun_id_links")
      .upsert(
        {
          angel_user_id: userId,
          fun_profile_user_id: normalized.funUserId,
          status: "active",
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "angel_user_id" }
      );

    // 7. Upsert profile info
    const profileUpdate: Record<string, unknown> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (normalized.displayName) profileUpdate.display_name = normalized.displayName;
    if (normalized.avatarUrl) profileUpdate.avatar_url = normalized.avatarUrl;

    await supabase
      .from("profiles")
      .upsert(profileUpdate, { onConflict: "user_id" });

    // 8. Generate session via magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalized.email,
    });

    if (linkError || !linkData) {
      console.error("Failed to generate link:", linkError);
      await audit({ success: false, failureReason: "magic_link_failed", tokenHash, email: normalized.email, funUserId: normalized.funUserId, angelUserId: userId });
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const linkUrl = new URL(linkData.properties.action_link);
    const token_hash =
      linkUrl.searchParams.get("token") ||
      linkUrl.hash?.match(/token=([^&]+)/)?.[1] ||
      linkUrl.searchParams.get("token_hash");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;
    const anonClient = createClient(supabaseUrl, anonKey);

    let sessionData;

    if (token_hash) {
      const { data: otpData, error: otpError } = await anonClient.auth.verifyOtp({
        token_hash,
        type: "magiclink",
      });

      if (otpError || !otpData.session) {
        console.error("OTP verify failed:", otpError);
      } else {
        sessionData = otpData.session;
      }
    }

    if (!sessionData) {
      const tempPassword = crypto.randomUUID();
      const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });

      if (updateUserError) {
        console.error("Failed to set temporary password:", updateUserError);
        await audit({ success: false, failureReason: "temp_password_failed", tokenHash, email: normalized.email, funUserId: normalized.funUserId, angelUserId: userId });
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: normalized.email,
        password: tempPassword,
      });

      if (signInError || !signInData.session) {
        console.error("Fallback sign-in failed:", signInError);
        await audit({ success: false, failureReason: "session_fallback_failed", tokenHash, email: normalized.email, funUserId: normalized.funUserId, angelUserId: userId });
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      sessionData = signInData.session;
    }

    // ✅ SUCCESS — log it
    await audit({
      success: true,
      tokenHash,
      email: normalized.email,
      funUserId: normalized.funUserId,
      angelUserId: userId,
    });

    return new Response(
      JSON.stringify({
        session: {
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        },
        user_id: userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bridge login error:", error);
    await audit({ success: false, failureReason: "internal_error", tokenHash });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
