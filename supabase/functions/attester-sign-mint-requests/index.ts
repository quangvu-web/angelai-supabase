import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_GROUPS = ["will", "wisdom", "love"] as const;
type GovGroupName = typeof REQUIRED_GROUPS[number];

const GOV_MEMBERS: Record<string, { name: string; group: GovGroupName }> = {
  "0xe32d50a0bade4cbd5b0d6120d3a5fd07f63694f1": { name: "Minh Trí", group: "will" },
  "0xfd0da7a744245e7aceccd786d5a743ef9291a557": { name: "Ánh Nguyệt", group: "will" },
  "0x02d5578173bd0db25462bb32a254cd4b2e6d9a0d": { name: "Thu Trang", group: "will" },
  "0xca319fbc39f519822385f2d0a0114b14fa89a301": { name: "Bé Giàu", group: "wisdom" },
  "0xdf8249159bb67804d718bc8186f95b75ce5ecbe8": { name: "Bé Ngọc", group: "wisdom" },
  "0x5102ecc4a458a1af76afa50d23359a712658a402": { name: "Ái Vân", group: "wisdom" },
  "0xe418a560611e80e4239f5513d41e583fc9ac2e6d": { name: "Thanh Tiên", group: "love" },
  "0x67464df3082828b3cf10c5cb08fc24a28228efd1": { name: "Bé Kim", group: "love" },
  "0x9ec8c51175526bebb1d04100256de71cf99b7ccc": { name: "Bé Hà", group: "love" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeGroups(groups: unknown): GovGroupName[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => String(group).toLowerCase())
    .filter((group): group is GovGroupName => REQUIRED_GROUPS.includes(group as GovGroupName));
}

function buildAttesterSigningMessage(params: {
  group: GovGroupName;
  signerAddress: string;
  requestIds: string[];
  timestamp: number;
}) {
  return [
    "FUN Attester Signature",
    `Group: ${params.group}`,
    `Signer: ${params.signerAddress.toLowerCase()}`,
    `Requests: ${[...params.requestIds].sort().join(",")}`,
    `Timestamp: ${params.timestamp}`,
  ].join("\n");
}

function mapMintRequest(request: any, profilesByUserId: Map<string, any>) {
  const requiredGroups = normalizeGroups(request.multisig_required_groups);
  return {
    id: request.id,
    action_id: request.action_id ?? "",
    actor_id: request.actor_id,
    recipient_address: request.recipient_address ?? "",
    amount: Number(request.amount ?? 0),
    amount_wei: request.amount_wei ?? null,
    action_hash: request.action_hash ?? "",
    evidence_hash: request.evidence_hash ?? "",
    nonce: Number(request.nonce ?? 0),
    status: request.status,
    multisig_signatures: request.multisig_signatures ?? {},
    multisig_completed_groups: normalizeGroups(request.multisig_completed_groups),
    multisig_required_groups: requiredGroups.length > 0 ? requiredGroups : [...REQUIRED_GROUPS],
    platform_id: request.platform_id ?? "angel_ai",
    created_at: request.created_at,
    tx_hash: request.tx_hash ?? null,
    actor_display_name: profilesByUserId.get(request.actor_id)?.display_name ?? null,
    actor_avatar_url: profilesByUserId.get(request.actor_id)?.avatar_url ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (body?.action === "list") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: requests, error } = await supabase
        .from("pplp_mint_requests")
        .select("*")
        .in("status", ["pending", "pending_sig", "signing", "signed"])
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) return json({ error: error.message }, 500);

      const actorIds = [...new Set((requests ?? []).map((request: any) => request.actor_id).filter(Boolean))];
      const { data: profiles } = actorIds.length > 0
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", actorIds)
        : { data: [] };
      const profilesByUserId = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile]));

      return json({ success: true, requests: (requests ?? []).map((request) => mapMintRequest(request, profilesByUserId)) });
    }

    const requestIds = Array.isArray(body?.request_ids)
      ? [...new Set(body.request_ids.map((id: unknown) => String(id)))]
      : [];
    const group = String(body?.group ?? "").toLowerCase() as GovGroupName;
    const signerAddress = String(body?.signer_address ?? "").trim();
    const signature = String(body?.signature ?? "").trim();
    const timestamp = Number(body?.timestamp ?? 0);

    if (requestIds.length === 0 || requestIds.length > 200 || requestIds.some((id) => !UUID_RE.test(id))) {
      return json({ error: "Danh sách lệnh ký không hợp lệ" }, 400);
    }
    if (!REQUIRED_GROUPS.includes(group) || !ethers.isAddress(signerAddress) || !signature || !Number.isFinite(timestamp)) {
      return json({ error: "Thông tin chữ ký không hợp lệ" }, 400);
    }
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return json({ error: "Chữ ký đã hết hạn, vui lòng ký lại" }, 400);
    }

    const signerKey = signerAddress.toLowerCase();
    const member = GOV_MEMBERS[signerKey];
    if (!member || member.group !== group) {
      return json({ error: "Ví ký không thuộc đúng nhóm GOV" }, 403);
    }

    const message = buildAttesterSigningMessage({ group, signerAddress: signerKey, requestIds, timestamp });
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== signerKey) {
      return json({ error: "Chữ ký ví không khớp với ví GOV" }, 403);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: requests, error: fetchError } = await supabase
      .from("pplp_mint_requests")
      .select("id,status,multisig_signatures,multisig_completed_groups,multisig_required_groups")
      .in("id", requestIds)
      .in("status", ["pending", "pending_sig", "signing"]);

    if (fetchError) return json({ error: fetchError.message }, 500);

    const now = new Date().toISOString();
    let signed = 0;
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const request of requests ?? []) {
      const required = normalizeGroups(request.multisig_required_groups);
      const requiredGroups = required.length > 0 ? required : [...REQUIRED_GROUPS];
      const completed = normalizeGroups(request.multisig_completed_groups);

      if (!requiredGroups.includes(group)) {
        skipped.push({ id: request.id, reason: "group_not_required" });
        continue;
      }
      if (completed.includes(group)) {
        skipped.push({ id: request.id, reason: "already_signed" });
        continue;
      }

      const newCompleted = [...new Set([...completed, group])];
      const isFullySigned = requiredGroups.every((requiredGroup) => newCompleted.includes(requiredGroup));
      const newSignatures = {
        ...((request.multisig_signatures as Record<string, unknown>) ?? {}),
        [group]: {
          signer_address: signerAddress,
          signer_name: member.name,
          signed_at: now,
          wallet_signature: signature,
        },
      };

      const { error: updateError } = await supabase
        .from("pplp_mint_requests")
        .update({
          multisig_signatures: newSignatures,
          multisig_completed_groups: newCompleted,
          status: isFullySigned ? "signed" : "signing",
          updated_at: now,
        })
        .eq("id", request.id)
        .in("status", ["pending", "pending_sig", "signing"]);

      if (updateError) {
        skipped.push({ id: request.id, reason: updateError.message });
      } else {
        signed++;
      }
    }

    const missingIds = requestIds.filter((id) => !(requests ?? []).some((request) => request.id === id));
    missingIds.forEach((id) => skipped.push({ id, reason: "not_pending" }));

    return json({ success: true, signed_count: signed, skipped_count: skipped.length, skipped });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});