import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TrendingUp, AlertTriangle, Info, Shield, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';

interface LedgerEntry {
  id: string;
  period: string;
  period_start: string;
  period_end: string;
  base_score: number;
  reputation_weight: number;
  consistency_multiplier: number;
  sequence_multiplier: number;
  integrity_penalty: number;
  final_light_score: number;
  level: string;
  explain_ref: string | null;
  computed_at: string;
  rule_version: string | null;
  reason_codes: string[] | null;
  trend: string | null;
}

interface Explanation {
  id: string;
  top_contributors_json: Array<{ action_type: string; light_score: number; reward: number }>;
  penalties_json: Array<{ signal_type: string; severity: number }>;
  ai_pillar_scores: Record<string, number> | null;
  ai_ego_risk: number | null;
  ai_explanation: string | null;
}

interface DailyBreakdown {
  date: string;
  base_action_score: number;
  content_score: number;
  daily_light_score: number;
  consistency_multiplier: number;
  sequence_multiplier: number;
  integrity_penalty: number;
  reputation_weight: number;
}

interface EligibilityResult {
  eligible: boolean;
  reason: string;
  epoch_score: number;
  avg_risk: number;
  pplp_accepted: boolean;
  has_cluster_review: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  seed: 'bg-gray-500',
  sprout: 'bg-green-500',
  builder: 'bg-blue-500',
  guardian: 'bg-purple-500',
  architect: 'bg-amber-500',
};

export function ScoreExplanationPanel() {
  const { user } = useAuth();
  const { currentLanguage: language } = useLanguage();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [explanations, setExplanations] = useState<Record<string, Explanation>>({});
  const [dailyBreakdowns, setDailyBreakdowns] = useState<DailyBreakdown[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch ledger, daily breakdowns, and eligibility in parallel
      const [ledgerRes, dailyRes] = await Promise.all([
        supabase
          .from('light_score_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('period_start', { ascending: false })
          .limit(10),
        supabase
          .from('features_user_day')
          .select('date, base_action_score, content_score, daily_light_score, consistency_multiplier, sequence_multiplier, integrity_penalty, reputation_weight')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(7),
      ]);

      if (ledgerRes.data && ledgerRes.data.length > 0) {
        setLedger(ledgerRes.data as unknown as LedgerEntry[]);
        
        const explainIds = ledgerRes.data.filter(l => l.explain_ref).map(l => l.explain_ref);
        if (explainIds.length > 0) {
          const { data: explData } = await supabase
            .from('score_explanations')
            .select('*')
            .in('id', explainIds);
          
          if (explData) {
            const map: Record<string, Explanation> = {};
            for (const e of explData) {
              map[e.id] = e as unknown as Explanation;
            }
            setExplanations(map);
          }
        }

        // Check eligibility using latest period
        const latest = ledgerRes.data[0];
        try {
          const { data: eligData } = await supabase.rpc('check_mint_eligibility', {
            _user_id: user.id,
            _epoch_start: latest.period_start.split('T')[0],
            _epoch_end: latest.period_end.split('T')[0],
          });
          if (eligData) setEligibility(eligData as unknown as EligibilityResult);
        } catch (_) {}
      }

      if (dailyRes.data) {
        setDailyBreakdowns(dailyRes.data as unknown as DailyBreakdown[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (!user) return null;
  if (loading) return <Card><CardContent className="p-4 text-center text-muted-foreground text-sm">Loading...</CardContent></Card>;
  if (ledger.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground text-sm">
          {language === 'vi' ? 'Chưa có dữ liệu Light Score' : 'No Light Score data yet'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          {language === 'vi' ? 'Giải trình Light Score (LS-Math v1.0)' : 'Light Score Explanation (LS-Math v1.0)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Eligibility Status */}
        {eligibility && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded ${
            eligibility.eligible
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {eligibility.eligible ? (
              <><CheckCircle className="h-3.5 w-3.5" /> {language === 'vi' ? 'Đủ điều kiện mint FUN' : 'Eligible for FUN mint'}</>
            ) : (
              <><XCircle className="h-3.5 w-3.5" /> {language === 'vi' ? 'Chưa đủ điều kiện: ' : 'Not eligible: '}
                {(eligibility.reason || 'unknown').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
              </>
            )}
          </div>
        )}

        {/* Daily Breakdown (last 7 days) */}
        {dailyBreakdowns.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {language === 'vi' ? 'Chi tiết hàng ngày (LS-Math)' : 'Daily Breakdown (LS-Math)'}
            </p>
            <div className="grid grid-cols-1 gap-1">
              {dailyBreakdowns.slice(0, 3).map((day) => (
                <div key={day.date} className="bg-muted/30 rounded p-1.5 text-[10px] grid grid-cols-4 gap-1">
                  <span className="font-mono">{day.date}</span>
                  <span>B: {Number(day.base_action_score).toFixed(2)}</span>
                  <span>C: {Number(day.content_score).toFixed(2)}</span>
                  <span className="text-primary font-medium">L: {Number(day.daily_light_score).toFixed(2)}</span>
                  <span className="col-span-4 text-muted-foreground">
                    M<sup>cons</sup>: ×{Number(day.consistency_multiplier).toFixed(2)} | 
                    M<sup>seq</sup>: ×{Number(day.sequence_multiplier).toFixed(2)} | 
                    Π: {(1 - Number(day.integrity_penalty)).toFixed(2)} | 
                    w: {Number(day.reputation_weight).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger Accordion */}
        <Accordion type="single" collapsible>
          {ledger.map((entry) => {
            const expl = entry.explain_ref ? explanations[entry.explain_ref] : null;
            return (
              <AccordionItem key={entry.id} value={entry.id}>
                <AccordionTrigger className="text-xs py-2">
                  <div className="flex items-center gap-2 w-full">
                    <Badge className={`${LEVEL_COLORS[entry.level] || 'bg-gray-500'} text-white text-[10px]`}>
                      {entry.level}
                    </Badge>
                    <span className="text-muted-foreground">
                      {entry.period} | {new Date(entry.period_start).toLocaleDateString()}
                    </span>
                    <span className="ml-auto font-mono text-primary">
                      {Number(entry.final_light_score).toFixed(1)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span>Epoch Score: {Number(entry.base_score).toFixed(1)}</span>
                    <span>Rep w: ×{Number(entry.reputation_weight).toFixed(2)}</span>
                    <span>M<sup>cons</sup>: ×{Number(entry.consistency_multiplier).toFixed(2)}</span>
                    <span>M<sup>seq</sup>: ×{Number(entry.sequence_multiplier).toFixed(2)}</span>
                    {entry.rule_version && (
                      <span className="col-span-2 text-[10px] bg-muted px-1.5 py-0.5 rounded w-fit">
                        Rule: {entry.rule_version}
                      </span>
                    )}
                    {Number(entry.integrity_penalty) > 0 && (
                      <span className="text-destructive col-span-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Π penalty: -{Number(entry.integrity_penalty).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {entry.reason_codes && entry.reason_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.reason_codes.map((code, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                          code.startsWith('INTERACTION_') || code.startsWith('RATING_') || code.startsWith('CONTENT_REVIEW') || code.startsWith('TEMPORARY_') || code.startsWith('QUALITY_')
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  )}

                  {expl && (
                    <>
                      {expl.top_contributors_json?.length > 0 && (
                        <div>
                          <p className="font-medium flex items-center gap-1 mb-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            {language === 'vi' ? 'Đóng góp chính' : 'Top Contributors'}
                          </p>
                          {expl.top_contributors_json.slice(0, 3).map((c, i) => (
                            <div key={i} className="flex justify-between text-muted-foreground">
                              <span>{c.action_type}</span>
                              <span>LS: {Number(c.light_score).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {expl.ai_explanation && (
                        <div className="bg-muted/50 rounded p-2 text-[11px]">
                          <p className="font-medium mb-1">🤖 AI Analysis</p>
                          <p className="text-muted-foreground">{expl.ai_explanation}</p>
                          {expl.ai_ego_risk != null && Number(expl.ai_ego_risk) > 0.3 && (
                            <p className="text-amber-500 mt-1">⚠️ Ego Risk: {(Number(expl.ai_ego_risk) * 100).toFixed(0)}%</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
