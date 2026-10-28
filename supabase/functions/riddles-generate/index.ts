import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { aiChat } from '../_shared/ai-gateway.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const THEMES = ['ánh sáng nội tâm', 'lòng biết ơn', 'kết nối', 'sáng tạo', 'chữa lành', 'trí tuệ']

async function generateRiddles() {
  const sys = `Bạn là người dẫn dắt mini game "Cosmic Riddles" của Angel AI. Hãy sinh 3 câu đố ngắn theo phong cách thiền/triết, mỗi câu dưới 25 từ tiếng Việt, có chiều sâu nhưng không tối nghĩa. Trả về JSON mảng 3 phần tử:
{"theme": "...", "prompt": "câu đố", "hint": "1 dòng gợi ý nhẹ", "meaning": "1-2 câu giải nghĩa", "keywords": ["3-6 từ khoá đáp án đúng"]}`
  const user = `Sinh 3 câu đố mới với chủ đề khác nhau từ: ${THEMES.join(', ')}. Trả về JSON array.`

  const r = await aiChat({
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    jsonObject: true,
    maxTokens: 1200,
  })
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`)
  const parsed = JSON.parse(r.text || '{}')
  const arr = Array.isArray(parsed) ? parsed : (parsed.riddles || parsed.data || [])
  if (!Array.isArray(arr) || arr.length < 3) throw new Error('AI returned invalid format')
  return { items: arr.slice(0, 3), provider: r.provider }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE)
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
      .toISOString().slice(0, 10)

    const { count } = await sb.from('cosmic_riddles')
      .select('id', { count: 'exact', head: true })
      .eq('riddle_date', today)
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ ok: true, skipped: true, date: today }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { items, provider } = await generateRiddles()
    const rows = items.map((r: Record<string, unknown>, i: number) => ({
      riddle_date: today,
      idx: i + 1,
      theme: String(r.theme ?? THEMES[i]),
      prompt: String(r.prompt ?? ''),
      hint: String(r.hint ?? ''),
      meaning: String(r.meaning ?? ''),
      expected_keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
      published: true,
    }))
    const { error } = await sb.from('cosmic_riddles').upsert(rows, { onConflict: 'riddle_date,idx' })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, date: today, count: rows.length, provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('riddles-generate error:', e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
