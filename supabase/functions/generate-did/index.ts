import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a keccak256-like hash using Web Crypto API
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate trust seed - cryptographic random
function generateTrustSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { wallet_address } = await req.json();

    // Check if user already has a DID
    const { data: existingDid } = await supabase
      .from('user_dids')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingDid) {
      // Return existing DID with SBT info
      const { data: sbt } = await supabase
        .from('soulbound_nfts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        already_exists: true,
        did: existingDid,
        soulbound_nft: sbt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== Generate DID ==========
    const trustSeed = generateTrustSeed();
    const didSource = `${user.id}:${user.email}:${wallet_address || 'none'}:${trustSeed}:${Date.now()}`;
    const didHash = await hashData(didSource);
    const did = `did:fun:${didHash.slice(0, 42)}`; // Truncate to address-like format

    // ========== Create DID record ==========
    const { data: newDid, error: didError } = await supabase
      .from('user_dids')
      .insert({
        user_id: user.id,
        did,
        did_hash: didHash,
        wallet_address: wallet_address || null,
        trust_seed: trustSeed,
        status: 'active',
        metadata: {
          created_by: 'dib_engine_v1',
          email_hash: await hashData(user.email || ''),
        },
      })
      .select()
      .single();

    if (didError) {
      console.error('[DIB] DID creation error:', didError);
      return new Response(JSON.stringify({ error: 'Failed to create DID', details: didError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== Create Soulbound NFT record (pending on-chain mint) ==========
    const sbtMetadata = {
      did,
      did_hash: didHash,
      trust_seed: trustSeed,
      created_at: new Date().toISOString(),
      user_id_hash: await hashData(user.id),
    };
    const metadataHash = await hashData(JSON.stringify(sbtMetadata));

    const { data: newSbt, error: sbtError } = await supabase
      .from('soulbound_nfts')
      .insert({
        user_id: user.id,
        did_id: newDid.id,
        did_hash: didHash,
        trust_seed: trustSeed,
        mint_status: 'pending',
        metadata_hash: metadataHash,
      })
      .select()
      .single();

    if (sbtError) {
      console.error('[DIB] SBT creation error:', sbtError);
    }

    // ========== Store initial identity metadata ==========
    const profileData = {
      email_hash: await hashData(user.email || ''),
      wallet_bound: !!wallet_address,
      identity_version: 1,
    };
    const profileHash = await hashData(JSON.stringify(profileData));

    await supabase.from('identity_metadata').insert({
      user_id: user.id,
      did_id: newDid.id,
      data_type: 'profile',
      data_hash: profileHash,
      version: 1,
      is_current: true,
    });

    // ========== Log DID creation event ==========
    await supabase.from('did_events').insert({
      user_id: user.id,
      did_id: newDid.id,
      event_type: 'created',
      event_data: {
        did,
        wallet_address: wallet_address || null,
        trust_seed_hash: await hashData(trustSeed),
      },
    });

    // If wallet provided, log wallet binding event
    if (wallet_address) {
      await supabase.from('did_events').insert({
        user_id: user.id,
        did_id: newDid.id,
        event_type: 'wallet_bound',
        event_data: { wallet_address, binding_type: 'primary' },
      });
    }

    // ========== Initialize Trust Profile + DIB (trigger auto-created rows; now compute initial values) ==========
    let initialTrust: any = null;
    try {
      const { data: trustData, error: trustErr } = await supabase
        .rpc('update_trust_profile', { _did_id: newDid.id });
      if (!trustErr) initialTrust = trustData;

      // Auto-issue Identity SBT for new DID
      await supabase.rpc('issue_sbt', {
        _did_id: newDid.id,
        _sbt_type: 'identity',
        _sbt_subtype: 'verified_human',
        _issuer: 'system',
        _trust_weight: 0.05,
        _metadata: { issued_on_did_creation: true },
      });

      // Compute initial DIB vault hashes
      await supabase.rpc('compute_dib_vault_hashes', { _did_id: newDid.id });
    } catch (e) {
      console.error('[DIB] Trust init warning:', e);
    }

    // ========== Generate snapshot hash for on-chain anchoring ==========
    const snapshotData = {
      did,
      did_hash: didHash,
      sbt_metadata_hash: metadataHash,
      timestamp: new Date().toISOString(),
    };
    const snapshotHash = await hashData(JSON.stringify(snapshotData));

    console.log(`[DIB] ✓ DID created: ${did} for user ${user.id.slice(0, 8)}... | TC=${initialTrust?.tc} Tier=${initialTrust?.tier} | Snapshot hash: ${snapshotHash.slice(0, 16)}...`);

    return new Response(JSON.stringify({
      success: true,
      did: newDid,
      soulbound_nft: newSbt || null,
      trust_profile: initialTrust,
      snapshot_hash: snapshotHash,
      message: 'Digital Identity created successfully. Trust profile + Identity SBT initialized.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[DIB] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
