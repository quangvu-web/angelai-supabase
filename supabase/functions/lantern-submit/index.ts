import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChat } from '../_shared/ai-gateway.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

interface Body {
  day_idx: number
  theme_key: string
  evidence: string
}

async function gradeWithAI(theme: string, evidence: string): Promise<{ score: number; reason: string }> {
  const sys = `Bạn là giám khảo nhẹ nhàng cho mini game "Lantern Path" — chấm điểm chân thật/sâu của một mẩu chia sẻ ngắn theo chủ đề tích cực. Trả về JSON: {"score": 0.0..1.0, "reason": "..."} với:
- 0.0-0.4 = quá ngắn, generic, copy paste, không liên quan
- 0.55-0.7 = hợp lý, có chi tiết
- 0.85-1.0 = cụ thể, chân thật, có cảm xúc/hành động rõ`
  const user = `Chủ đề: ${theme}\n\nNội dung user gửi:\n"""${evidence}"""\n\nChấm điểm.`

  const r = await aiChat({
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    jsonObject: true,
    maxTokens: 200,
  })
  if (r.ok) {
    try {
      const parsed = JSON.parse(r.text || '{}')
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reason: String(parsed.reason ?? ''),
      }
    } catch { /* fall through */ }
  }
  // Fallback heuristic: length-based
  const len = evidence.length
  const score = len >= 120 ? 0.7 : len >= 60 ? 0.6 : 0.5
  return { score, reason: 'fallback_heuristic' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: auth } } })

    const body: Body = await req.json()
    if (typeof body.day_idx !== 'number' || !body.theme_key || typeof body.evidence !== 'string') {
      return new Response(JSON.stringify({ error: 'invalid_input' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (body.evidence.trim().length < 30) {
      return new Response(JSON.stringify({ error: 'evidence_too_short' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { score, reason } = await gradeWithAI(body.theme_key, body.evidence)

    const { data, error } = await supabase.rpc('lantern_complete_day', {
      p_day_idx: body.day_idx,
      p_theme_key: body.theme_key,
      p_evidence: body.evidence,
      p_ai_score: score,
    })
    if (error) throw error

    return new Response(JSON.stringify({ ...data, ai_reason: reason }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('lantern-submit error', e)
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
