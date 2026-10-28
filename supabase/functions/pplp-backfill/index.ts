import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * PPLP Backfill Edge Function
 * 
 * Populates `features_user_day` and `pplp_events` from existing data:
 * - community_posts → count_posts + POST_CREATED events
 * - community_comments → count_comments + COMMENT_CREATED events
 * - chat_history → count_questions + QUESTION_ASKED events
 * - gratitude_journal → count_journals + JOURNAL_WRITTEN events
 * - community_helps → count_help + HELP_GIVEN events
 * - daily_login_tracking → count_logins + LOGIN events
 * 
 * Then triggers pplp-compute-daily-scores for each date.
 * 
 * Body params:
 * - dry_run: boolean (default false) — if true, only return stats without writing
 * - user_id: string (optional) — backfill only for specific user
 * - limit_days: number (default 90) — how many days back to process
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let dryRun = false;
    let targetUserId: string | null = null;
    let limitDays = 90;
    let skipScoring = false;

    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
      targetUserId = body.user_id || null;
      limitDays = body.limit_days || 90;
      skipScoring = body.skip_scoring === true;
    } catch { /* no body */ }

    console.log(`[Backfill] Starting. dry_run=${dryRun}, user_id=${targetUserId}, limit_days=${limitDays}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - limitDays);
    const cutoffISO = cutoffDate.toISOString();

    // ============ 1. Gather all activity data grouped by (user_id, date) ============

    type DayKey = string; // "user_id|YYYY-MM-DD"
    interface DayData {
      user_id: string;
      date: string;
      count_posts: number;
      count_comments: number;
      count_questions: number;
      count_journals: number;
      count_help: number;
      count_logins: number;
      events: Array<{ event_type: string; target_id: string | null; occurred_at: string }>;
    }

    const dayMap = new Map<DayKey, DayData>();

    function getOrCreate(userId: string, date: string): DayData {
      const key = `${userId}|${date}`;
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          user_id: userId,
          date,
          count_posts: 0,
          count_comments: 0,
          count_questions: 0,
          count_journals: 0,
          count_help: 0,
          count_logins: 0,
          events: [],
        });
      }
      return dayMap.get(key)!;
    }

    function toDateStr(ts: string): string {
      return ts.substring(0, 10);
    }

    // --- Posts ---
    let postsQuery = supabase
      .from('community_posts')
      .select('user_id, created_at, id')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true });
    if (targetUserId) postsQuery = postsQuery.eq('user_id', targetUserId);

    const { data: posts } = await postsQuery.limit(5000);
    for (const p of posts || []) {
      const d = getOrCreate(p.user_id, toDateStr(p.created_at));
      d.count_posts++;
      d.events.push({ event_type: 'POST_CREATED', target_id: p.id, occurred_at: p.created_at });
    }

    // --- Comments ---
    let commentsQuery = supabase
      .from('community_comments')
      .select('user_id, created_at, id, post_id')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true });
    if (targetUserId) commentsQuery = commentsQuery.eq('user_id', targetUserId);

    const { data: comments } = await commentsQuery.limit(5000);
    for (const c of comments || []) {
      const d = getOrCreate(c.user_id, toDateStr(c.created_at));
      d.count_comments++;
      d.events.push({ event_type: 'COMMENT_CREATED', target_id: c.post_id, occurred_at: c.created_at });
    }

    // --- Chat (questions) ---
    let chatsQuery = supabase
      .from('chat_history')
      .select('user_id, created_at, id')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true });
    if (targetUserId) chatsQuery = chatsQuery.eq('user_id', targetUserId);

    const { data: chats } = await chatsQuery.limit(5000);
    for (const q of chats || []) {
      const d = getOrCreate(q.user_id, toDateStr(q.created_at));
      d.count_questions++;
      d.events.push({ event_type: 'QUESTION_ASKED', target_id: q.id, occurred_at: q.created_at });
    }

    // --- Journals ---
    let journalsQuery = supabase
      .from('gratitude_journal')
      .select('user_id, created_at, id')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true });
    if (targetUserId) journalsQuery = journalsQuery.eq('user_id', targetUserId);

    const { data: journals } = await journalsQuery.limit(5000);
    for (const j of journals || []) {
      const d = getOrCreate(j.user_id, toDateStr(j.created_at));
      d.count_journals++;
      d.events.push({ event_type: 'JOURNAL_WRITTEN', target_id: j.id, occurred_at: j.created_at });
    }

    // --- Helps ---
    let helpsQuery = supabase
      .from('community_helps')
      .select('helper_id, created_at, id')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: true });
    if (targetUserId) helpsQuery = helpsQuery.eq('helper_id', targetUserId);

    const { data: helps } = await helpsQuery.limit(5000);
    for (const h of helps || []) {
      const d = getOrCreate(h.helper_id, toDateStr(h.created_at));
      d.count_help++;
      d.events.push({ event_type: 'HELP_GIVEN', target_id: h.id, occurred_at: h.created_at });
    }

    // --- Logins ---
    let loginsQuery = supabase
      .from('daily_login_tracking')
      .select('user_id, login_date')
      .gte('login_date', cutoffISO.substring(0, 10));
    if (targetUserId) loginsQuery = loginsQuery.eq('user_id', targetUserId);

    const { data: logins } = await loginsQuery.limit(5000);
    for (const l of logins || []) {
      const d = getOrCreate(l.user_id, l.login_date);
      d.count_logins++;
      d.events.push({ event_type: 'LOGIN', target_id: null, occurred_at: `${l.login_date}T00:00:00Z` });
    }

    // ============ 2. Dry run stats ============
    const allDays = Array.from(dayMap.values());
    const uniqueUsers = new Set(allDays.map(d => d.user_id)).size;
    const uniqueDates = new Set(allDays.map(d => d.date)).size;
    const totalEvents = allDays.reduce((sum, d) => sum + d.events.length, 0);

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        unique_users: uniqueUsers,
        unique_dates: uniqueDates,
        total_user_days: allDays.length,
        total_events: totalEvents,
        sample: allDays.slice(0, 5).map(d => ({
          user_id: d.user_id,
          date: d.date,
          posts: d.count_posts,
          comments: d.count_comments,
          questions: d.count_questions,
          journals: d.count_journals,
          help: d.count_help,
          logins: d.count_logins,
          events_count: d.events.length,
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============ 3. Write features_user_day ============
    let featuresWritten = 0;
    let featuresErrors = 0;

    // Process in batches of 50
    for (let i = 0; i < allDays.length; i += 50) {
      const batch = allDays.slice(i, i + 50);
      const rows = batch.map(d => ({
        user_id: d.user_id,
        date: d.date,
        count_posts: d.count_posts,
        count_comments: d.count_comments,
        count_questions: d.count_questions,
        count_journals: d.count_journals,
        count_help: d.count_help,
        count_logins: d.count_logins,
        daily_light_score: 0, // will be computed by pplp-compute-daily-scores
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('features_user_day')
        .upsert(rows, { onConflict: 'user_id,date' });

      if (error) {
        console.error(`[Backfill] features_user_day batch error:`, error);
        featuresErrors += batch.length;
      } else {
        featuresWritten += batch.length;
      }
    }

    console.log(`[Backfill] features_user_day: ${featuresWritten} written, ${featuresErrors} errors`);

    // ============ 4. Write pplp_events (skip duplicates via ingest_hash) ============
    let eventsWritten = 0;
    let eventsSkipped = 0;

    // Flatten all events
    const allEvents = allDays.flatMap(d =>
      d.events.map(e => ({
        actor_user_id: d.user_id,
        event_type: e.event_type,
        target_id: e.target_id,
        occurred_at: e.occurred_at,
        source: 'backfill',
        ingest_hash: `backfill:${e.event_type}:${d.user_id}:${e.target_id || e.occurred_at}`,
      }))
    );

    // Insert in batches of 100
    for (let i = 0; i < allEvents.length; i += 100) {
      const batch = allEvents.slice(i, i + 100);
      const { error, count } = await supabase
        .from('pplp_events')
        .upsert(batch, { onConflict: 'ingest_hash', ignoreDuplicates: true })
        .select('event_id', { count: 'exact', head: true });

      if (error) {
        // Some duplicates are expected, count them
        console.warn(`[Backfill] pplp_events batch warning:`, error.message);
        eventsSkipped += batch.length;
      } else {
        eventsWritten += batch.length;
      }
    }

    console.log(`[Backfill] pplp_events: ${eventsWritten} written, ${eventsSkipped} skipped`);

    // ============ 5. Trigger daily score computation (unless skipped) ============
    const dates = [...new Set(allDays.map(d => d.date))].sort();
    let scoresComputed = 0;

    if (!skipScoring) {
      for (const date of dates) {
        try {
          const res = await fetch(
            `${supabaseUrl}/functions/v1/pplp-compute-daily-scores`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ target_date: date, process_all: true }),
            }
          );
          if (res.ok) {
            scoresComputed++;
          } else {
            console.error(`[Backfill] Score compute failed for ${date}: ${res.status}`);
          }
        } catch (e) {
          console.error(`[Backfill] Score compute error for ${date}:`, e);
        }
      }
      console.log(`[Backfill] Computed scores for ${scoresComputed}/${dates.length} dates`);
    } else {
      console.log(`[Backfill] Skipping score computation (skip_scoring=true)`);
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        unique_users: uniqueUsers,
        unique_dates: uniqueDates,
        features_written: featuresWritten,
        features_errors: featuresErrors,
        events_written: eventsWritten,
        events_skipped: eventsSkipped,
        dates_scored: scoresComputed,
        total_dates: dates.length,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
