import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Heart, Shield, Users, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface PPLPRatingCardProps {
  contentId: string;
  contentAuthorId: string;
  onRated?: () => void;
}

const PILLARS = [
  { key: 'truth', label: 'Chân thật', labelEn: 'Truth', icon: Shield, color: 'text-blue-500' },
  { key: 'sustain', label: 'Bền vững', labelEn: 'Sustain', icon: Sparkles, color: 'text-green-500' },
  { key: 'heal', label: 'Chữa lành', labelEn: 'Heal', icon: Heart, color: 'text-pink-500' },
  { key: 'service', label: 'Phụng sự', labelEn: 'Service', icon: Star, color: 'text-amber-500' },
  { key: 'unity', label: 'Hợp nhất', labelEn: 'Unity', icon: Users, color: 'text-purple-500' },
] as const;

export function PPLPRatingCard({ contentId, contentAuthorId, onRated }: PPLPRatingCardProps) {
  const { user } = useAuth();
  const { currentLanguage: language } = useLanguage();
  const [scores, setScores] = useState<Record<string, number>>({
    truth: 0, sustain: 0, heal: 0, service: 0, unity: 0,
  });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user || user.id === contentAuthorId) return null;

  const handleScore = (pillar: string, value: number) => {
    setScores(prev => ({ ...prev, [pillar]: prev[pillar] === value ? 0 : value }));
  };

  const handleSubmit = async () => {
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    if (totalScore === 0) {
      toast.error(language === 'vi' ? 'Vui lòng chấm ít nhất 1 trụ' : 'Please rate at least 1 pillar');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('pplp_ratings').upsert({
        content_id: contentId,
        rater_user_id: user.id,
        pillar_truth: scores.truth,
        pillar_sustain: scores.sustain,
        pillar_heal_love: scores.heal,
        pillar_life_service: scores.service,
        pillar_unity_source: scores.unity,
        comment: comment || null,
      }, { onConflict: 'content_id,rater_user_id' });

      if (error) throw error;

      // Submit as PPLP action
      await supabase.functions.invoke('pplp-submit-action', {
        body: {
          platform_id: 'ANGEL_AI',
          action_type: 'PPLP_RATING_SUBMITTED',
          target_id: contentId,
          metadata: { pillar_scores: scores, rated_content_id: contentId },
        },
      });

      toast.success(language === 'vi' ? 'Đã chấm điểm 5 trụ!' : '5 Pillar rating submitted!');
      onRated?.();
    } catch (err) {
      console.error('Rating error:', err);
      toast.error(language === 'vi' ? 'Lỗi khi chấm điểm' : 'Rating failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {language === 'vi' ? '⭐ Chấm điểm 5 Trụ Ánh Sáng' : '⭐ Rate 5 Light Pillars'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-5 gap-1">
          {PILLARS.map(({ key, label, labelEn, icon: Icon, color }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {language === 'vi' ? label : labelEn}
              </span>
              <div className="flex gap-0.5">
                {[1, 2].map(v => (
                  <button
                    key={v}
                    onClick={() => handleScore(key, v)}
                    className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                      scores[key] >= v
                        ? 'bg-primary text-primary-foreground scale-110'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <Textarea
          placeholder={language === 'vi' ? 'Nhận xét (tùy chọn)...' : 'Comment (optional)...'}
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="h-16 text-xs resize-none"
        />
        
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full text-xs"
        >
          {isSubmitting
            ? (language === 'vi' ? 'Đang gửi...' : 'Submitting...')
            : (language === 'vi' ? 'Gửi đánh giá' : 'Submit Rating')}
        </Button>
      </CardContent>
    </Card>
  );
}
