import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeepAnalysis {
  pillars?: {
    repentance: number;
    gratitude: number;
    service: number;
    helping: number;
    giving: number;
  };
  nlp_features?: {
    authenticity: number;
    love_tone: number;
    depth: number;
    ego_signal: number;
  };
  ego_risk?: number;
  explanation?: string;
  analyzed_at?: string;
}

interface Props {
  postId: string;
  cached?: DeepAnalysis | null;
}

const PILLAR_LABELS: Array<[keyof NonNullable<DeepAnalysis["pillars"]>, string]> = [
  ["repentance", "Sám Hối"],
  ["gratitude", "Biết Ơn"],
  ["service", "Phụng Sự"],
  ["helping", "Giúp Đỡ"],
  ["giving", "Trao Tặng"],
];

export function PostDeepAnalysisButton({ postId, cached }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(cached || null);

  const handleClick = async () => {
    if (analysis && open) {
      setOpen(false);
      return;
    }
    if (analysis) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pplp-deep-analysis", {
        body: { post_id: postId },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setOpen(true);
      } else {
        toast.error("Không nhận được kết quả phân tích");
      }
    } catch (e) {
      console.error("Deep analysis error:", e);
      toast.error("Không thể phân tích lúc này, thử lại sau nhé");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="w-full justify-start text-xs text-primary-deep hover:bg-primary-pale/40"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        )}
        {open ? "Ẩn phân tích Angel AI" : "Xem Angel AI phân tích sâu hơn"}
      </Button>

      <AnimatePresence>
        {open && analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 rounded-xl border border-primary/15 bg-gradient-to-br from-primary-pale/30 to-transparent p-3 overflow-hidden"
          >
            {analysis.pillars && (
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {PILLAR_LABELS.map(([key, label]) => {
                  const value = analysis.pillars![key] ?? 0;
                  return (
                    <div key={key} className="text-center">
                      <div className="text-[10px] text-foreground-muted leading-tight">{label}</div>
                      <div className="mt-1 font-semibold text-sm text-primary-deep">
                        {value}/2
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-primary/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary-deep"
                          style={{ width: `${(value / 2) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {analysis.nlp_features && (
              <div className="flex flex-wrap gap-2 text-[11px] mb-3">
                <Badge label="Chân thật" value={analysis.nlp_features.authenticity} />
                <Badge label="Tình thương" value={analysis.nlp_features.love_tone} />
                <Badge label="Chiều sâu" value={analysis.nlp_features.depth} />
                <Badge
                  label="Cái tôi"
                  value={analysis.nlp_features.ego_signal}
                  inverted
                />
              </div>
            )}

            {analysis.explanation && (
              <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">
                <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                {analysis.explanation}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  const pct = Math.round(value * 100);
  // For ego_signal: high = bad → invert color logic
  const isGood = inverted ? value < 0.4 : value >= 0.5;
  return (
    <span
      className={`px-2 py-0.5 rounded-full border ${
        isGood
          ? "border-primary/30 bg-primary-pale/40 text-primary-deep"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      }`}
    >
      {label}: {pct}%
    </span>
  );
}
