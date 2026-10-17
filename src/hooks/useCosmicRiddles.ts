import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface RiddleItem {
  id: string
  idx: number
  theme: string
  prompt: string
  hint: string | null
  attempted: boolean
  ai_score: number | null
  reward_camly: number | null
  reward_xp: number | null
  reward_sparks: number | null
  meaning: string | null
}

export interface RiddleState {
  riddle_date: string
  riddles: RiddleItem[]
  sparks: number
}

export function useCosmicRiddles() {
  const qc = useQueryClient()

  const state = useQuery({
    queryKey: ['cosmic-riddles', 'today'],
    queryFn: async (): Promise<RiddleState> => {
      const { data, error } = await supabase.rpc('riddle_get_today')
      if (error) throw error
      return (data as unknown as RiddleState) ?? { riddle_date: '', riddles: [], sparks: 0 }
    },
    staleTime: 30_000,
  })

  const submit = useMutation({
    mutationFn: async ({ riddle_id, answer }: { riddle_id: string; answer: string }) => {
      const { data, error } = await supabase.functions.invoke('riddles-submit', {
        body: { riddle_id, answer },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      return data as { score: number; reward_camly: number; reward_xp: number; reward_sparks: number; reason?: string }
    },
    onSuccess: (d) => {
      const s = Math.round((d.score ?? 0) * 100)
      if (d.reward_camly > 0) {
        toast.success(`+${d.reward_camly} Camly · +${d.reward_xp} XP${d.reward_sparks ? ` · +${d.reward_sparks} ✨ Spark` : ''}`, {
          description: `AI chấm ${s}/100`,
        })
      } else {
        toast.message('Câu trả lời chưa đạt mốc', { description: `AI chấm ${s}/100 — thử sâu hơn nhé` })
      }
      qc.invalidateQueries({ queryKey: ['cosmic-riddles'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Không gửi được'),
  })

  const exchange = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('riddle_exchange_sparks')
      if (error) throw error
      return data as { ok: boolean; sparks_remaining: number }
    },
    onSuccess: (d) => {
      toast.success('Đổi 10 ✨ Spark → 1 Mystery Box Rare', { description: `Còn ${d.sparks_remaining} Spark` })
      qc.invalidateQueries({ queryKey: ['cosmic-riddles'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (e: Error) => {
      const msg = e.message?.includes('not_enough_sparks') ? 'Cần ≥ 10 Spark để đổi' : e.message
      toast.error(msg ?? 'Lỗi đổi Spark')
    },
  })

  return { state, submit, exchange }
}
