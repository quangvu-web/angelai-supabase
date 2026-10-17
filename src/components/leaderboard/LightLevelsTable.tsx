import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LIGHT_LEVELS = [
  { level: 1, icon: "🌱", nameVi: "Hiện diện tích cực", nameEn: "Light Presence", min: 0, max: 199, color: "#8BC34A" },
  { level: 2, icon: "🌟", nameVi: "Người tạo giá trị", nameEn: "Light Contributor", min: 200, max: 499, color: "#FFC107" },
  { level: 3, icon: "🔨", nameVi: "Người xây dựng", nameEn: "Light Builder", min: 500, max: 999, color: "#FF9800" },
  { level: 4, icon: "🛡️", nameVi: "Người bảo vệ", nameEn: "Light Guardian", min: 1000, max: 1999, color: "#2196F3" },
  { level: 5, icon: "👑", nameVi: "Người thiết kế", nameEn: "Light Architect", min: 2000, max: null, color: "#9C27B0" },
];

const MAX_SCORE = 2500;

function formatScore(n: number) {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

export function LightLevelsTable() {
  const [open, setOpen] = useState(false);
  const { t, currentLanguage } = useLanguage();
  const isVi = currentLanguage === "vi";

  return (
    <div className="max-w-2xl mx-auto px-4 pb-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-400/10 to-amber-500/10 border border-amber-400/30 hover:border-amber-400/50 transition-all group">
            <span className="text-sm font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              {t("lightLevels.title")}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-amber-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mt-3 space-y-2.5"
              >
                {LIGHT_LEVELS.map((lvl, i) => {
                  const progress = lvl.max
                    ? ((lvl.max - lvl.min) / MAX_SCORE) * 100
                    : 100;
                  const rangeText = lvl.max
                    ? `${formatScore(lvl.min)} – ${formatScore(lvl.max)} LS`
                    : `${formatScore(lvl.min)}+ LS`;

                  return (
                    <motion.div
                      key={lvl.level}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="relative overflow-hidden rounded-2xl border p-3.5 transition-all hover:scale-[1.01] hover:shadow-lg"
                      style={{
                        borderColor: lvl.color + "40",
                        background: `linear-gradient(135deg, ${lvl.color}08 0%, ${lvl.color}15 50%, ${lvl.color}05 100%)`,
                      }}
                    >
                      {/* Shimmer overlay */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.07]"
                        style={{
                          background: `linear-gradient(110deg, transparent 25%, ${lvl.color}60 50%, transparent 75%)`,
                          backgroundSize: "200% 100%",
                          animation: "shimmer 3s ease-in-out infinite",
                        }}
                      />

                      <div className="relative flex items-center gap-3">
                        {/* Icon circle */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${lvl.color}22, ${lvl.color}44)`,
                            border: `2px solid ${lvl.color}88`,
                            boxShadow: `0 0 12px ${lvl.color}30`,
                          }}
                        >
                          {lvl.icon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span
                              className="text-sm font-extrabold"
                              style={{ color: lvl.color }}
                            >
                              Lv.{lvl.level}
                            </span>
                            <span
                              className="text-sm font-bold truncate"
                              style={{ color: lvl.color }}
                            >
                              {isVi ? lvl.nameVi : lvl.nameEn}
                            </span>
                          </div>

                          {/* Score range */}
                          <p className="text-xs text-muted-foreground font-medium mt-0.5">
                            ⚡ {rangeText}
                          </p>

                          {/* Progress bar */}
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, progress)}%` }}
                              transition={{ delay: i * 0.08 + 0.2, duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{
                                background: `linear-gradient(90deg, ${lvl.color}99, ${lvl.color})`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 200% 0; }
          50% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
