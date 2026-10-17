import { useState } from 'react'
import { useNavigate } from '@/lib/router-compat'
import { ArrowLeft, Sparkles, Lightbulb, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useCosmicRiddles, type RiddleItem } from '@/hooks/useCosmicRiddles'
import { Skeleton } from '@/components/ui/skeleton'

function RiddleCard({ r, onSubmit, submitting }: {
  r: RiddleItem
  onSubmit: (id: string, answer: string) => void
  submitting: boolean
}) {
  const [answer, setAnswer] = useState('')
  const [showHint, setShowHint] = useState(false)
  const minLen = 20
  const canSubmit = !r.attempted && answer.trim().length >= minLen && !submitting

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="capitalize">#{r.idx} · {r.theme}</Badge>
        {r.attempted && (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Đã giải · {Math.round((r.ai_score ?? 0) * 100)}/100
          </Badge>
        )}
      </div>

      <p className="text-lg font-medium leading-relaxed">{r.prompt}</p>

      {!r.attempted && r.hint && (
        <button
          onClick={() => setShowHint((s) => !s)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <Lightbulb className="w-4 h-4" /> {showHint ? 'Ẩn gợi ý' : 'Xem gợi ý'}
        </button>
      )}
      {!r.attempted && showHint && r.hint && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-amber-400/50 pl-3">{r.hint}</p>
      )}

      {r.attempted ? (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
          {(r.reward_camly ?? 0) > 0 ? (
            <p>
              <span className="font-semibold text-amber-600">+{r.reward_camly} Camly</span>
              {' · '}<span className="font-semibold text-blue-600">+{r.reward_xp} XP</span>
              {(r.reward_sparks ?? 0) > 0 && <> {' · '}<span className="font-semibold text-violet-600">+{r.reward_sparks} ✨ Spark</span></>}
            </p>
          ) : (
            <p className="text-muted-foreground">Câu trả lời chưa đạt mốc thưởng (cần ≥ 0.4).</p>
          )}
          {r.meaning && (
            <p className="text-muted-foreground"><span className="font-medium">Ý nghĩa:</span> {r.meaning}</p>
          )}
        </div>
      ) : (
        <>
          <Textarea
            placeholder="Viết cảm nhận / câu trả lời của bạn (tối thiểu 20 ký tự)…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, 600))}
            rows={4}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{answer.length}/600 · tối thiểu {minLen}</span>
            <Button
              onClick={() => onSubmit(r.id, answer.trim())}
              disabled={!canSubmit}
              className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gửi & nhận thưởng'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

export default function Riddles() {
  const navigate = useNavigate()
  const { state, submit, exchange } = useCosmicRiddles()
  const data = state.data

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-w-11 min-h-11">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" /> Cosmic Riddles
          </h1>
          <p className="text-sm text-muted-foreground">3 câu đố ánh sáng mỗi ngày · AI chấm sâu/chân thật</p>
        </div>
      </div>

      <Card className="p-4 flex items-center justify-between bg-gradient-to-br from-violet-500/10 to-amber-500/10 border-amber-500/20">
        <div>
          <p className="text-sm text-muted-foreground">✨ Riddle Spark</p>
          <p className="text-2xl font-extrabold">{data?.sparks ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">10 Spark = 1 Mystery Box Rare</p>
        </div>
        <Button
          onClick={() => exchange.mutate()}
          disabled={(data?.sparks ?? 0) < 10 || exchange.isPending}
          variant="secondary"
        >
          {exchange.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Đổi 10 ✨'}
        </Button>
      </Card>

      {state.isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      )}

      {!state.isLoading && (data?.riddles?.length ?? 0) === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Hôm nay chưa có câu đố. Cosmic AI sẽ phát hành vào 00:10 (giờ VN).
        </Card>
      )}

      <div className="space-y-4">
        {data?.riddles?.map((r) => (
          <RiddleCard
            key={r.id}
            r={r}
            onSubmit={(id, ans) => submit.mutate({ riddle_id: id, answer: ans })}
            submitting={submit.isPending}
          />
        ))}
      </div>
    </div>
  )
}
