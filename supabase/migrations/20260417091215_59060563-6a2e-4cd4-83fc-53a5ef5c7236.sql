-- ============================================================
-- L — Advanced Sybil Analytics: risk scoring, graph, clusters
-- ============================================================

-- 1) Risk score per DID (composite)
CREATE OR REPLACE FUNCTION public.get_did_risk_score(_did_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _flags_open int;
  _flags_total int;
  _burst_max int;
  _reciprocal_pairs int;
  _avg_pair_count numeric;
  _sybil text;
  _score numeric;
  _band text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(sybil_risk,'low') INTO _sybil
    FROM public.trust_profile WHERE did_id = _did_id;

  SELECT COUNT(*) FILTER (WHERE NOT is_resolved),
         COUNT(*)
    INTO _flags_open, _flags_total
    FROM public.attestation_abuse_flags
    WHERE did_id = _did_id;

  -- max attestations sent in any 1-hour window in the last 7 days
  SELECT COALESCE(MAX(c),0) INTO _burst_max FROM (
    SELECT COUNT(*)::int c
    FROM public.attestation_log
    WHERE from_did = _did_id
      AND created_at >= now() - interval '7 days'
    GROUP BY date_trunc('hour', created_at)
  ) s;

  -- distinct pairs where reciprocity exists (A→B AND B→A) within 30 days
  SELECT COUNT(DISTINCT a.to_did) INTO _reciprocal_pairs
    FROM public.attestation_log a
    WHERE a.from_did = _did_id
      AND a.created_at >= now() - interval '30 days'
      AND EXISTS (
        SELECT 1 FROM public.attestation_log b
        WHERE b.from_did = a.to_did
          AND b.to_did = _did_id
          AND b.created_at >= now() - interval '30 days'
      );

  -- avg attestations per (from→to) pair in last 30d (high = repetition)
  SELECT COALESCE(AVG(c),0) INTO _avg_pair_count FROM (
    SELECT COUNT(*)::int c
    FROM public.attestation_log
    WHERE from_did = _did_id
      AND created_at >= now() - interval '30 days'
    GROUP BY to_did
  ) s;

  -- composite risk 0..100
  _score :=
      LEAST(100, (_flags_open * 15) + (_flags_total * 4)
                 + (_burst_max * 6)
                 + (_reciprocal_pairs * 8)
                 + (CASE WHEN _avg_pair_count > 2 THEN (_avg_pair_count - 2) * 10 ELSE 0 END)
                 + (CASE _sybil WHEN 'critical' THEN 40 WHEN 'high' THEN 25 WHEN 'medium' THEN 10 ELSE 0 END));

  _band := CASE
    WHEN _score >= 75 THEN 'critical'
    WHEN _score >= 50 THEN 'high'
    WHEN _score >= 25 THEN 'medium'
    ELSE 'low' END;

  RETURN jsonb_build_object(
    'did_id', _did_id,
    'risk_score', round(_score, 1),
    'risk_band', _band,
    'sybil_risk', _sybil,
    'flags_open', _flags_open,
    'flags_total', _flags_total,
    'burst_max_1h_7d', _burst_max,
    'reciprocal_pairs_30d', _reciprocal_pairs,
    'avg_pair_count_30d', round(_avg_pair_count, 2)
  );
END;
$$;

-- 2) Top risky DIDs (heatmap source)
CREATE OR REPLACE FUNCTION public.get_top_risky_dids(_limit int DEFAULT 50)
RETURNS TABLE (
  did_id uuid,
  did text,
  display_name text,
  trust_tier text,
  sybil_risk text,
  risk_score numeric,
  risk_band text,
  flags_open int,
  flags_total int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      d.id AS did_id,
      d.did,
      COALESCE(o.display_name, d.did) AS display_name,
      tp.trust_tier,
      COALESCE(tp.sybil_risk, 'low') AS sybil_risk,
      (SELECT COUNT(*)::int FROM public.attestation_abuse_flags f WHERE f.did_id = d.id AND NOT f.is_resolved) AS flags_open,
      (SELECT COUNT(*)::int FROM public.attestation_abuse_flags f WHERE f.did_id = d.id) AS flags_total,
      COALESCE((
        SELECT MAX(c) FROM (
          SELECT COUNT(*)::int c FROM public.attestation_log
          WHERE from_did = d.id AND created_at >= now() - interval '7 days'
          GROUP BY date_trunc('hour', created_at)
        ) s
      ), 0) AS burst_max,
      (SELECT COUNT(DISTINCT a.to_did)::int FROM public.attestation_log a
        WHERE a.from_did = d.id
          AND a.created_at >= now() - interval '30 days'
          AND EXISTS (SELECT 1 FROM public.attestation_log b
                      WHERE b.from_did = a.to_did AND b.to_did = d.id
                        AND b.created_at >= now() - interval '30 days')) AS recip_pairs
    FROM public.user_dids d
    LEFT JOIN public.trust_profile tp ON tp.did_id = d.id
    LEFT JOIN public.org_profiles o ON o.did_id = d.id
  )
  SELECT
    b.did_id, b.did, b.display_name, b.trust_tier, b.sybil_risk,
    round(LEAST(100, (b.flags_open*15) + (b.flags_total*4) + (b.burst_max*6) + (b.recip_pairs*8)
      + (CASE b.sybil_risk WHEN 'critical' THEN 40 WHEN 'high' THEN 25 WHEN 'medium' THEN 10 ELSE 0 END))::numeric, 1) AS risk_score,
    CASE
      WHEN (b.flags_open*15)+(b.flags_total*4)+(b.burst_max*6)+(b.recip_pairs*8)
        + (CASE b.sybil_risk WHEN 'critical' THEN 40 WHEN 'high' THEN 25 WHEN 'medium' THEN 10 ELSE 0 END) >= 75 THEN 'critical'
      WHEN (b.flags_open*15)+(b.flags_total*4)+(b.burst_max*6)+(b.recip_pairs*8)
        + (CASE b.sybil_risk WHEN 'critical' THEN 40 WHEN 'high' THEN 25 WHEN 'medium' THEN 10 ELSE 0 END) >= 50 THEN 'high'
      WHEN (b.flags_open*15)+(b.flags_total*4)+(b.burst_max*6)+(b.recip_pairs*8)
        + (CASE b.sybil_risk WHEN 'critical' THEN 40 WHEN 'high' THEN 25 WHEN 'medium' THEN 10 ELSE 0 END) >= 25 THEN 'medium'
      ELSE 'low' END AS risk_band,
    b.flags_open, b.flags_total
  FROM base b
  ORDER BY risk_score DESC, flags_open DESC
  LIMIT _limit;
END;
$$;

-- 3) Trust graph data (nodes + edges) seeded around a DID, depth=1
CREATE OR REPLACE FUNCTION public.get_trust_graph(_seed_did uuid, _days int DEFAULT 30, _max_edges int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _edges jsonb;
  _nodes jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH e AS (
    SELECT a.from_did, a.to_did, COUNT(*)::int weight,
           bool_or(EXISTS (
             SELECT 1 FROM public.attestation_log b
             WHERE b.from_did = a.to_did AND b.to_did = a.from_did
               AND b.created_at >= now() - (_days || ' days')::interval
           )) AS reciprocal,
           MAX(a.created_at) AS last_at
    FROM public.attestation_log a
    WHERE a.created_at >= now() - (_days || ' days')::interval
      AND (a.from_did = _seed_did OR a.to_did = _seed_did
           OR a.from_did IN (SELECT to_did FROM public.attestation_log
                             WHERE from_did = _seed_did
                               AND created_at >= now() - (_days || ' days')::interval)
           OR a.to_did IN (SELECT to_did FROM public.attestation_log
                           WHERE from_did = _seed_did
                             AND created_at >= now() - (_days || ' days')::interval))
    GROUP BY a.from_did, a.to_did
    ORDER BY weight DESC
    LIMIT _max_edges
  )
  SELECT jsonb_agg(jsonb_build_object(
    'from', from_did, 'to', to_did, 'weight', weight,
    'reciprocal', reciprocal, 'last_at', last_at))
  INTO _edges FROM e;

  WITH ids AS (
    SELECT (jsonb_array_elements(_edges)->>'from')::uuid AS id
    UNION
    SELECT (jsonb_array_elements(_edges)->>'to')::uuid AS id
  ),
  n AS (
    SELECT d.id AS did_id, d.did,
           COALESCE(o.display_name, substring(d.did from '#"_______"%' for '#')) AS label,
           COALESCE(tp.trust_tier, 'T0') AS trust_tier,
           COALESCE(tp.sybil_risk, 'low') AS sybil_risk,
           (SELECT COUNT(*)::int FROM public.attestation_abuse_flags f WHERE f.did_id = d.id AND NOT f.is_resolved) AS flags_open,
           (d.id = _seed_did) AS is_seed
    FROM ids
    JOIN public.user_dids d ON d.id = ids.id
    LEFT JOIN public.trust_profile tp ON tp.did_id = d.id
    LEFT JOIN public.org_profiles o ON o.did_id = d.id
  )
  SELECT jsonb_agg(to_jsonb(n)) INTO _nodes FROM n;

  RETURN jsonb_build_object(
    'seed_did', _seed_did,
    'days', _days,
    'nodes', COALESCE(_nodes, '[]'::jsonb),
    'edges', COALESCE(_edges, '[]'::jsonb)
  );
END;
$$;

-- 4) Detect Sybil clusters (mutually attesting groups of size >= 3)
CREATE OR REPLACE FUNCTION public.detect_sybil_clusters(_days int DEFAULT 14, _min_size int DEFAULT 3, _limit int DEFAULT 20)
RETURNS TABLE (
  cluster_key text,
  member_count int,
  edge_count int,
  reciprocal_ratio numeric,
  avg_risk numeric,
  member_dids jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT from_did, to_did
    FROM public.attestation_log
    WHERE created_at >= now() - (_days || ' days')::interval
  ),
  recip AS (
    SELECT LEAST(from_did, to_did) AS a, GREATEST(from_did, to_did) AS b
    FROM recent r
    WHERE EXISTS (SELECT 1 FROM recent r2 WHERE r2.from_did = r.to_did AND r2.to_did = r.from_did)
    GROUP BY 1,2
  ),
  -- 3-cycles via mutual edges
  triangles AS (
    SELECT DISTINCT
      LEAST(r1.a, r1.b, r2.b) AS x,
      (ARRAY[r1.a, r1.b, r2.b]) AS members
    FROM recip r1
    JOIN recip r2 ON r2.a = r1.b
    JOIN recip r3 ON r3.a = LEAST(r1.a, r2.b) AND r3.b = GREATEST(r1.a, r2.b)
  ),
  agg AS (
    SELECT
      array_to_string(ARRAY(SELECT unnest(members) ORDER BY 1), ',') AS cluster_key,
      members
    FROM triangles
  ),
  uniq AS (
    SELECT cluster_key, MIN(members) AS members
    FROM agg
    GROUP BY cluster_key
  ),
  enriched AS (
    SELECT
      u.cluster_key,
      array_length(u.members, 1) AS member_count,
      (SELECT COUNT(*)::int FROM recent r
        WHERE r.from_did = ANY(u.members) AND r.to_did = ANY(u.members)) AS edge_count,
      (SELECT COUNT(*)::numeric FROM recip rc
        WHERE rc.a = ANY(u.members) AND rc.b = ANY(u.members)) AS recip_count,
      (SELECT COALESCE(AVG(
          CASE COALESCE(tp.sybil_risk,'low')
            WHEN 'critical' THEN 90 WHEN 'high' THEN 70 WHEN 'medium' THEN 40 ELSE 10 END
        ), 0) FROM public.trust_profile tp WHERE tp.did_id = ANY(u.members)) AS avg_risk,
      (SELECT jsonb_agg(jsonb_build_object(
          'did_id', d.id, 'did', d.did,
          'display_name', COALESCE(o.display_name, d.did),
          'sybil_risk', COALESCE(tp.sybil_risk,'low'),
          'trust_tier', COALESCE(tp.trust_tier,'T0')))
        FROM public.user_dids d
        LEFT JOIN public.org_profiles o ON o.did_id = d.id
        LEFT JOIN public.trust_profile tp ON tp.did_id = d.id
        WHERE d.id = ANY(u.members)) AS member_dids
    FROM uniq u
  )
  SELECT
    e.cluster_key,
    e.member_count,
    e.edge_count,
    CASE WHEN e.edge_count = 0 THEN 0 ELSE round(e.recip_count*2.0 / e.edge_count, 2) END AS reciprocal_ratio,
    round(e.avg_risk, 1) AS avg_risk,
    e.member_dids
  FROM enriched e
  WHERE e.member_count >= _min_size
  ORDER BY e.avg_risk DESC, e.edge_count DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_did_risk_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_risky_dids(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trust_graph(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_sybil_clusters(int, int, int) TO authenticated;