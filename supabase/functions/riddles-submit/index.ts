import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChat } from '../_shared/ai-gateway.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function gradeAnswer(prompt: string, meaning: string, keywords: string[], answer: string) {
  const sys = `Bạn là giám khảo nhẹ nhàng cho "Cosmic Riddles". Chấm 0–1 dựa trên: (1) độ chân thật/sâu, (2) bám sát ý nghĩa câu đố, (3) chạm tới các từ khoá gợi ý. Trả JSON {"score": 0..1, "reason": "1 câu ngắn"}.
- 0.0–0.4 = lạc đề / quá ngắn / copy
- 0.55–0.7 = đúng hướng, có liên hệ
- 0.85–1.0 = chạm sâu, có cảm xúc/trải nghiệm cá nhân`
  const user = `Câu đố: ${prompt}\nÝ nghĩa ẩn: ${meaning}\nTừ khoá gợi ý: ${keywords.join(', ')}\n\nUser trả lời:\n"""${answer}"""\n\nChấm điểm.`

  const r = await aiChat({
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    jsonObject: true,
    maxTokens: 200,
  })
  if (r.ok) {
    try {
      const parsed = JSON.parse(r.text || '{}')
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reason: String(parsed.reason ?? ''),
        provider: r.provider,
      }
    } catch { /* fall through */ }
  }
  // Fallback: keyword overlap heuristic
  const a = answer.toLowerCase()
  const hits = keywords.filter((k) => a.includes(String(k).toLowerCase())).length
  const base = answer.length >= 60 ? 0.55 : 0.4
  return { score: Math.min(1, base + hits * 0.1), reason: 'fallback_heuristic', provider: 'fallback' as const }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { riddle_id, answer } = await req.json()
    if (!riddle_id || typeof answer !== 'string' || answer.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'answer_too_short', min: 20 }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: riddle, error: rErr } = await admin
      .from('cosmic_riddles')
      .select('id, prompt, meaning, expected_keywords, riddle_date')
      .eq('id', riddle_id).single()
    if (rErr || !riddle) {
      return new Response(JSON.stringify({ error: 'riddle_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const graded = await gradeAnswer(
      riddle.prompt, riddle.meaning ?? '',
      (riddle.expected_keywords ?? []) as string[], answer
    )

    const { data, error } = await admin.rpc('riddle_record_attempt', {
      p_user_id: user.id,
      p_riddle_id: riddle_id,
      p_answer: answer,
      p_ai_score: graded.score,
      p_ai_reason: graded.reason,
    })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, ...((data as Record<string, unknown>) ?? {}), reason: graded.reason, provider: graded.provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('riddles-submit error:', e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
