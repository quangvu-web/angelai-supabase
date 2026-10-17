import { useNavigate } from '@/lib/router-compat'
import { Sparkles, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useCosmicRiddles } from '@/hooks/useCosmicRiddles'

export function RiddleMiniCard() {
  const navigate = useNavigate()
  const { state } = useCosmicRiddles()
  const riddles = state.data?.riddles ?? []
  const done = riddles.filter((r) => r.attempted).length
  const total = riddles.length || 3
  const sparks = state.data?.sparks ?? 0

  return (
    <Card
      onClick={() => navigate('/riddles')}
      className="p-4 cursor-pointer hover:shadow-md transition bg-gradient-to-br from-violet-500/10 to-amber-500/10 border-amber-500/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold">Cosmic Riddles</p>
            <p className="text-xs text-muted-foreground">
              {done}/{total} câu hôm nay · ✨ {sparks} Spark
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </Card>
  )
}
