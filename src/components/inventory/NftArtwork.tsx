import { motion } from "framer-motion";

type Props = {
  collection: string;
  tokenId: number | string;
  traits?: Record<string, any>;
  ownerId?: string;
  className?: string;
};

// Deterministic hash → 0..1
const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

const palettes: Record<string, [string, string, string, string]> = {
  lighthouse_badge: ["#fff7d6", "#ffd166", "#f4a259", "#7a3b00"],
  pet_genesis: ["#e6fff4", "#8ef0c4", "#34d39977", "#0f5a3d"],
  light_spark_violet: ["#fbeaff", "#d8b4fe", "#a78bfa", "#3b0a6b"],
  light_spark_rose: ["#ffe9f1", "#fda4af", "#f43f5e", "#6b0a2a"],
  light_spark_azure: ["#e0f2ff", "#93c5fd", "#3b82f6", "#0a2a6b"],
  light_spark_gold: ["#fff5d1", "#ffe08a", "#f5a623", "#6b4a0a"],
  lamp_keeper: ["#fff1d0", "#ffc864", "#e07a1f", "#3a1a00"],
  treasure_map_paper: ["#f5e9c8", "#e0c98a", "#a07b3a", "#3a2200"],
  treasure_map_silk: ["#f0e6ff", "#c4b3ff", "#7a52ff", "#1a0a4a"],
  treasure_map_gold: ["#fff3b0", "#ffd24d", "#c98a00", "#3a2400"],
  cosmic_seed: ["#0b1030", "#1e2a78", "#6c4cff", "#ffffff"],
  angel_wing_bronze: ["#fff0e0", "#f0c896", "#b07840", "#3a1a00"],
  angel_wing_silver: ["#f0f4f8", "#cfd8e3", "#90a4b8", "#1a2030"],
  angel_wing_gold: ["#fff6d0", "#ffd966", "#c98a00", "#3a2400"],
  angel_wing_diamond: ["#e6f9ff", "#a8e1ff", "#5fb8ff", "#0a2a4a"],
  guardian_aurora: ["#0a1a2e", "#1b3a5b", "#3ad9c0", "#ffd166"],
  guardian_ember: ["#1a0a0a", "#5b1b1b", "#ff5a3a", "#ffd166"],
  guardian_frost: ["#eaf6ff", "#a8d4f0", "#3a78b8", "#0a1a3a"],
  guardian_void: ["#0a0820", "#22184a", "#7a52ff", "#e0d8ff"],
};

const pickSparkPalette = (seed: number) => {
  const keys = ["light_spark_violet", "light_spark_rose", "light_spark_azure", "light_spark_gold"];
  return palettes[keys[Math.floor(seed * keys.length) % keys.length]];
};

const NftArtworkBase = ({ collection, tokenId, traits, className }: Props) => {
  const seed = hash01(`${collection}:${tokenId}`);
  const seed2 = hash01(`${collection}:${tokenId}:b`);
  const seed3 = hash01(`${collection}:${tokenId}:c`);
  // Per-token vibe: durations + direction vary per token so no two NFT animate the same way
  const dir = seed3 < 0.5 ? 1 : -1;
  const fast = 0.8 + seed * 0.8;        // 0.8 .. 1.6
  const med = 1.6 + seed2 * 1.4;        // 1.6 .. 3.0
  const slow = 8 + seed3 * 14;          // 8 .. 22
  const blink = 3 + seed * 4;           // 3 .. 7 s between blinks

  if (collection === "lighthouse_badge") {
    const [c1, c2, c3, ink] = palettes.lighthouse_badge;
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Lighthouse Badge">
        <defs>
          <radialGradient id={`lh-bg-${tokenId}`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </radialGradient>
          <radialGradient id={`lh-glow-${tokenId}`} cx="50%" cy="38%" r="55%">
            <stop offset="0%" stopColor="#fff8c8" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff8c8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#lh-bg-${tokenId})`} />
        <motion.circle
          cx="50" cy="42" r="30" fill={`url(#lh-glow-${tokenId})`}
          animate={{ scale: [1, 1.05 + seed2 * 0.2, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: med, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 42%" }}
        />
        <path d="M40 70 L60 70 L57 50 L43 50 Z" fill={c3} stroke={ink} strokeWidth="1.5" />
        <ellipse cx="50" cy="50" rx="9" ry="4" fill={c1} stroke={ink} strokeWidth="1.2" />
        <motion.path
          d="M50 30 C46 36 46 42 50 46 C54 42 54 36 50 30 Z"
          fill="#fff2a8" stroke="#f59e0b" strokeWidth="1"
          animate={{
            scaleY: [1, 1.05 + seed * 0.2, 0.92, 1],
            scaleX: [1, 0.92 - seed2 * 0.1, 1.05, 1],
            x: [0, dir * (0.4 + seed2 * 0.6), -dir * 0.3, 0],
            y: [0, -1 - seed * 0.5, 0.5, 0],
          }}
          transition={{ duration: fast, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 46%" }}
        />
        <rect x="36" y="70" width="28" height="6" rx="2" fill={ink} />
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: blink, repeat: Infinity, times: [0, 0.85, 0.9, 0.95, 1], ease: "easeInOut" }}
          style={{ transformOrigin: "50px 60px" }}
        >
          <circle cx="46" cy="60" r="1.3" fill={ink} />
          <circle cx="54" cy="60" r="1.3" fill={ink} />
        </motion.g>
        <path d="M47 64 Q50 66 53 64" stroke={ink} strokeWidth="1" fill="none" strokeLinecap="round" />
        {Array.from({ length: 2 + Math.floor(seed2 * 4) }).map((_, i) => (
          <motion.g key={i}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.1, 0.5] }}
            transition={{ duration: 1.6 + seed * 1.2, repeat: Infinity, delay: i * (0.3 + seed3 * 0.5) }}>
            <circle cx={14 + ((i * 22 + seed * 40) % 72)} cy={10 + ((i * 13 + seed2 * 30) % 30)} r="1.5" fill="#fff" />
          </motion.g>
        ))}
      </svg>
    );
  }

  if (collection === "pet_genesis") {
    const [c1, c2, c3, ink] = palettes.pet_genesis;
    const ev = String(traits?.evolution ?? "spark");
    const stageGlow = { spark: 1, glow: 1.3, flame: 1.6, star: 1.9, sun: 2.2, cosmos: 2.5 }[ev] ?? 1;
    const personality = String(traits?.personality ?? "joyful");
    // Joyful = bouncy, Wise = slow float, Bold = strong sway, Gentle = soft drift
    const floatDur = personality === "joyful" ? 1.6 + seed * 0.4
      : personality === "wise" ? 3.4 + seed * 0.6
      : personality === "bold" ? 2.0 + seed * 0.4
      : 2.8 + seed * 0.5;
    const floatAmp = personality === "joyful" ? 4 : personality === "bold" ? 3 : 2;
    const swayDeg = personality === "bold" ? 6 : personality === "wise" ? 1.5 : 3;
    const starCount = Math.min(8, 3 + Math.floor(stageGlow * 1.5));
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Pet Genesis">
        <defs>
          <radialGradient id={`pg-bg-${tokenId}`} cx="50%" cy="55%" r="75%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </radialGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#pg-bg-${tokenId})`} />
        {/* sun rays for sun/cosmos */}
        {stageGlow >= 2.2 && (
          <motion.g
            animate={{ rotate: 360 * dir }}
            transition={{ duration: slow * 1.5, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 55%" }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={i} x1="50" y1="55" x2="50" y2={ev === "cosmos" ? 8 : 14}
                stroke="#ffd166" strokeWidth="1.2" opacity="0.6"
                transform={`rotate(${i * 30} 50 55)`} />
            ))}
          </motion.g>
        )}
        <motion.circle
          cx="50" cy="55" r={18 * stageGlow} fill="#ffffff" opacity="0.25"
          animate={{ scale: [1, 1.05 + stageGlow * 0.04, 1] }}
          transition={{ duration: floatDur * 1.1, repeat: Infinity }}
          style={{ transformOrigin: "50% 55%" }}
        />
        <motion.g
          animate={{ y: [0, -floatAmp, 0], rotate: [-swayDeg * dir, swayDeg * dir, -swayDeg * dir] }}
          transition={{ duration: floatDur, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50px 58px" }}
        >
          <ellipse cx="50" cy="58" rx="22" ry="24" fill={c3} stroke={ink} strokeWidth="1.5" />
          <ellipse cx="50" cy="52" rx="16" ry="10" fill="#ffffff" opacity="0.35" />
          {/* eyes with blink */}
          <motion.g
            animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
            transition={{ duration: blink, repeat: Infinity, times: [0, 0.88, 0.92, 0.96, 1], ease: "easeInOut" }}
            style={{ transformOrigin: "50px 56px" }}
          >
            <circle cx="42" cy="56" r="2.5" fill={ink} />
            <circle cx="58" cy="56" r="2.5" fill={ink} />
            <circle cx="42.8" cy="55.2" r="0.9" fill="#fff" />
            <circle cx="58.8" cy="55.2" r="0.9" fill="#fff" />
          </motion.g>
          {/* blush pulse */}
          <motion.g
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: floatDur * 1.3, repeat: Infinity }}
          >
            <circle cx="40" cy="63" r="2" fill="#ff8aa8" />
            <circle cx="60" cy="63" r="2" fill="#ff8aa8" />
          </motion.g>
          {/* smile — bold = open, gentle = small */}
          {personality === "bold" ? (
            <ellipse cx="50" cy="67" rx="3" ry="2" fill={ink} />
          ) : (
            <path d="M45 66 Q50 70 55 66" stroke={ink} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          )}
        </motion.g>
        {/* crown for higher stages — wobble */}
        {stageGlow >= 1.6 && (
          <motion.path d="M38 34 L44 40 L50 32 L56 40 L62 34 L60 44 L40 44 Z"
            fill="#ffd166" stroke={ink} strokeWidth="1"
            animate={{ rotate: [-2, 2, -2], y: [0, -0.5, 0] }}
            transition={{ duration: floatDur, repeat: Infinity }}
            style={{ transformOrigin: "50px 38px" }}
          />
        )}
        {/* tiny stars — count scales with stage */}
        {Array.from({ length: starCount }).map((_, i) => {
          const x = 8 + ((seed2 * 80 + i * 19) % 84);
          const y = 8 + ((seed * 60 + i * 11) % 28);
          return (
            <motion.text key={i} x={x} y={y} fontSize="6" textAnchor="middle"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, dir * 180, dir * 360] }}
              transition={{ duration: 1.8 + seed3 * 1.5, repeat: Infinity, delay: i * (0.2 + seed * 0.3) }}>
              {ev === "cosmos" ? "🌟" : "✨"}
            </motion.text>
          );
        })}
      </svg>
    );
  }

  if (collection === "lamp_keeper") {
    const [c1, c2, c3, ink] = palettes.lamp_keeper;
    const share = Number(traits?.share_pct ?? 0.25);
    // Brighter flame + more rays when share_pct is higher
    const flameDur = Math.max(0.9, 2.2 - share * 1.6);
    const rayCount = Math.min(12, 4 + Math.round(share * 12));
    const rayLen = 22 - share * 10;
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Lamp Keeper">
        <defs>
          <radialGradient id={`lk-bg-${tokenId}`} cx="50%" cy="55%" r="75%">
            <stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} />
          </radialGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#lk-bg-${tokenId})`} />
        <line x1="50" y1="6" x2="50" y2="22" stroke={ink} strokeWidth="1.2" strokeDasharray="2 2" />
        {/* Lantern gently swings */}
        <motion.g
          animate={{ rotate: [-2 * dir, 2 * dir, -2 * dir] }}
          transition={{ duration: med * 1.3, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50px 22px" }}
        >
          <path d="M34 30 L66 30 L66 36 L62 36 L62 64 L38 64 L38 36 L34 36 Z"
            fill={c3} stroke={ink} strokeWidth="1.5" />
          <rect x="40" y="38" width="20" height="24" rx="2" fill={c1} stroke={ink} strokeWidth="1" />
          <motion.g
            animate={{ scale: [1, 1.1 + share * 0.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: flameDur, repeat: Infinity }}
            style={{ transformOrigin: "50% 52%" }}
          >
            <circle cx="50" cy="52" r={5 + share * 3} fill="#fff2a8" opacity="0.9" />
            <path d="M50 44 C46 48 46 56 50 58 C54 56 54 48 50 44 Z" fill="#f59e0b" />
          </motion.g>
          <rect x="32" y="64" width="36" height="6" rx="2" fill={ink} />
          <rect x="42" y="70" width="16" height="4" rx="1" fill={ink} opacity="0.7" />
        </motion.g>
        {/* halo rays — count + length scale with share_pct */}
        {Array.from({ length: rayCount }).map((_, i) => {
          const a = (i * 360) / rayCount;
          return (
            <motion.line key={i} x1="50" y1="52" x2="50" y2={52 - rayLen}
              stroke="#fff2a8" strokeWidth="1.2" opacity="0.5"
              transform={`rotate(${a} 50 52)`}
              animate={{ opacity: [0.15, 0.7 + share * 0.2, 0.15] }}
              transition={{ duration: flameDur * 1.4, repeat: Infinity, delay: (i / rayCount) * flameDur }}
            />
          );
        })}
      </svg>
    );
  }

  if (collection === "treasure_map_fragment") {
    const rarity = String(traits?.rarity ?? "paper");
    const key = (`treasure_map_${rarity}`) as keyof typeof palettes;
    const [c1, c2, c3, ink] = palettes[key] ?? palettes.treasure_map_paper;
    const idx = Number(traits?.fragment_index ?? Math.floor(seed * 5) + 1);
    // Gold = fast magical trail, silk = medium, paper = slow ink
    const dashDur = rarity === "gold" ? 0.7 : rarity === "silk" ? 1.1 : 1.6;
    const xPulse = rarity === "gold" ? 1.1 : 1.5;
    const xColor = rarity === "gold" ? "#fbbf24" : "#dc2626";
    // Different curve per fragment_index so each piece looks unique
    const trail = [
      "M28 70 Q40 50 50 58 T76 32",
      "M22 30 Q40 28 52 42 T80 70",
      "M30 80 Q34 60 56 56 T72 24",
      "M76 78 Q60 64 48 50 T22 28",
      "M28 28 Q48 38 52 60 T78 78",
    ][(idx - 1) % 5];
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Treasure Map Fragment">
        <defs>
          <linearGradient id={`tm-bg-${tokenId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#tm-bg-${tokenId})`} />
        <motion.path d="M18 22 L82 18 L86 78 L72 86 L22 82 Z"
          fill={c1} stroke={c3} strokeWidth="1.5" opacity="0.95"
          animate={{ rotate: [-0.6 * dir, 0.6 * dir, -0.6 * dir] }}
          transition={{ duration: med * 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 50%" }}
        />
        <motion.path
          d={trail}
          stroke={ink} strokeWidth="1.5" fill="none"
          strokeDasharray="3 3"
          animate={{ strokeDashoffset: [0, -12 * dir] }}
          transition={{ duration: dashDur, repeat: Infinity, ease: "linear" }}
        />
        <motion.g
          animate={{ scale: [1, xPulse, 1], rotate: [0, dir * 15, 0] }}
          transition={{ duration: dashDur * 1.3, repeat: Infinity }}
          style={{ transformOrigin: "76px 32px" }}
        >
          <line x1="72" y1="28" x2="80" y2="36" stroke={xColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="80" y1="28" x2="72" y2="36" stroke={xColor} strokeWidth="2.5" strokeLinecap="round" />
        </motion.g>
        {/* compass needle spins slowly */}
        <circle cx="30" cy="32" r="6" fill="none" stroke={ink} strokeWidth="1" />
        <motion.path d="M30 27 L32 32 L30 37 L28 32 Z" fill={ink}
          animate={{ rotate: 360 * dir }}
          transition={{ duration: slow, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "30px 32px" }}
        />
        {/* gold rarity shimmer */}
        {rarity === "gold" && Array.from({ length: 4 }).map((_, i) => (
          <motion.circle key={i} cx={28 + i * 18} cy={50 + (i % 2) * 10} r="1" fill="#fff"
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
        <text x="50" y="94" textAnchor="middle" fontSize="9" fontWeight="bold" fill={ink}>
          {idx}/5
        </text>
      </svg>
    );
  }

  if (collection === "cosmic_seed") {
    const [c1, c2, c3, c4] = palettes.cosmic_seed;
    const stage = String(traits?.stage ?? "seed");
    const stageScale = ({ seed: 1, sprout: 1.2, bloom: 1.5 } as Record<string, number>)[stage] ?? 1;
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Cosmic Seed">
        <defs>
          <radialGradient id={`cs-bg-${tokenId}`} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor={c2} /><stop offset="100%" stopColor={c1} />
          </radialGradient>
          <radialGradient id={`cs-core-${tokenId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c4} />
            <stop offset="50%" stopColor={c3} />
            <stop offset="100%" stopColor={c1} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#cs-bg-${tokenId})`} />
        {/* starfield — more stars + faster twinkle at later stages */}
        {Array.from({ length: 14 + Math.floor(stageScale * 8) }).map((_, i) => {
          const x = hash01(`${tokenId}:x:${i}`) * 100;
          const y = hash01(`${tokenId}:y:${i}`) * 100;
          const r = 0.3 + hash01(`${tokenId}:r:${i}`) * 1.4;
          return (
            <motion.circle key={i} cx={x} cy={y} r={r} fill="#ffffff"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: 1.6 + (i % 4) * 0.6, repeat: Infinity, delay: i * 0.08 }}
            />
          );
        })}
        {/* orbit ring — bloom = 2 rings opposite spin */}
        <motion.ellipse cx="50" cy="50" rx={28} ry={10}
          fill="none" stroke={c3} strokeWidth="1" opacity="0.5"
          animate={{ rotate: 360 * dir }}
          transition={{ duration: slow * (stageScale > 1.2 ? 0.6 : 1), repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        />
        {stage === "bloom" && (
          <motion.ellipse cx="50" cy="50" rx={22} ry={6}
            fill="none" stroke={c4} strokeWidth="0.8" opacity="0.6"
            animate={{ rotate: -360 * dir }}
            transition={{ duration: slow * 0.7, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          />
        )}
        <motion.g
          animate={{ scale: [stageScale, stageScale * (1.05 + stageScale * 0.05), stageScale], rotate: stage === "seed" ? 0 : [-3, 3, -3] }}
          transition={{ duration: stageScale > 1.2 ? fast : med, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle cx="50" cy="50" r="18" fill={`url(#cs-core-${tokenId})`} />
          <ellipse cx="50" cy="50" rx="8" ry="12" fill={c4} opacity="0.9" />
          <ellipse cx="48" cy="46" rx="2.5" ry="4" fill="#ffffff" opacity="0.7" />
        </motion.g>
        {stage !== "seed" && (
          <motion.path d="M50 32 Q44 26 48 20 Q52 26 50 32 Z" fill="#7ee787"
            animate={{ rotate: [-8 * dir, 8 * dir, -8 * dir], scaleY: [1, 1.15, 1] }}
            transition={{ duration: med, repeat: Infinity }}
            style={{ transformOrigin: "50px 32px" }}
          />
        )}
        {stage === "bloom" && (
          <motion.g
            animate={{ rotate: 360 * dir }}
            transition={{ duration: slow, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            <circle cx="38" cy="36" r="3" fill="#ff8aa8" />
            <circle cx="62" cy="36" r="3" fill="#ffd166" />
            <circle cx="50" cy="22" r="3" fill="#7ee787" />
            <circle cx="36" cy="64" r="2.5" fill="#a78bfa" />
            <circle cx="64" cy="64" r="2.5" fill="#7dd3fc" />
          </motion.g>
        )}
      </svg>
    );
  }

  if (collection === "angel_wing") {
    const tier = String(traits?.tier ?? "bronze");
    const key = (`angel_wing_${tier}`) as keyof typeof palettes;
    const [c1, c2, c3, ink] = palettes[key] ?? palettes.angel_wing_bronze;
    // Diamond flaps fast & shimmery, bronze slow & steady
    const tierIdx = ["bronze", "silver", "gold", "diamond"].indexOf(tier);
    const flapDur = [3, 2.4, 1.8, 1.3][Math.max(0, tierIdx)];
    const flapAngle = [3, 4, 5, 7][Math.max(0, tierIdx)];
    const haloDur = [2.6, 2.2, 1.8, 1.4][Math.max(0, tierIdx)];
    const featherCount = [3, 4, 5, 6][Math.max(0, tierIdx)];
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Angel Wing">
        <defs>
          <radialGradient id={`aw-bg-${tokenId}`} cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} />
          </radialGradient>
          <linearGradient id={`aw-feat-${tokenId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#aw-bg-${tokenId})`} />
        {/* Halo — stronger for higher tiers */}
        <motion.ellipse cx="50" cy="22" rx="14" ry="4"
          fill="none" stroke={c3} strokeWidth={1.5 + tierIdx * 0.5}
          animate={{ opacity: [0.5, 1, 0.5], ry: [3.5, 4.5 + tierIdx * 0.3, 3.5], rx: [14, 15, 14] }}
          transition={{ duration: haloDur, repeat: Infinity }}
        />
        {/* Diamond tier: extra outer halo glow */}
        {tier === "diamond" && (
          <motion.ellipse cx="50" cy="22" rx="20" ry="6"
            fill="none" stroke={c3} strokeWidth="0.8" opacity="0.4"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: haloDur * 1.2, repeat: Infinity }}
            style={{ transformOrigin: "50px 22px" }}
          />
        )}
        <motion.g
          animate={{ rotate: [-flapAngle, flapAngle, -flapAngle], scaleX: [1, 1.04, 1] }}
          transition={{ duration: flapDur, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50px 50px" }}
        >
          <path d="M50 38 Q24 42 18 64 Q28 60 36 62 Q26 70 24 80 Q40 70 50 68 Z"
            fill={`url(#aw-feat-${tokenId})`} stroke={ink} strokeWidth="1.2" />
          <path d="M50 38 Q76 42 82 64 Q72 60 64 62 Q74 70 76 80 Q60 70 50 68 Z"
            fill={`url(#aw-feat-${tokenId})`} stroke={ink} strokeWidth="1.2" />
          {Array.from({ length: featherCount }).map((_, i) => (
            <g key={i}>
              <path d={`M${40 - i * 4} ${54 + i * 3} Q${28 - i * 3} ${58 + i * 3} ${22 - i * 3} ${64 + i * 3}`}
                stroke={ink} strokeWidth="0.6" fill="none" opacity="0.5" />
              <path d={`M${60 + i * 4} ${54 + i * 3} Q${72 + i * 3} ${58 + i * 3} ${78 + i * 3} ${64 + i * 3}`}
                stroke={ink} strokeWidth="0.6" fill="none" opacity="0.5" />
            </g>
          ))}
        </motion.g>
        {/* Heart core — beats faster for higher tier */}
        <motion.path d="M50 52 C46 48 40 50 40 56 C40 62 50 68 50 68 C50 68 60 62 60 56 C60 50 54 48 50 52 Z"
          fill="#ff5577" stroke={ink} strokeWidth="1"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: flapDur * 0.5, repeat: Infinity }}
          style={{ transformOrigin: "50% 60%" }}
        />
        {/* Diamond/gold tier: shimmer sparkles */}
        {tierIdx >= 2 && Array.from({ length: tierIdx + 1 }).map((_, i) => (
          <motion.circle key={i} cx={20 + ((i * 22 + seed * 40) % 60)} cy={32 + (i % 2) * 8} r="1.2" fill="#fff"
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 0.4] }}
            transition={{ duration: 1.4 + seed3 * 0.6, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </svg>
    );
  }

  if (collection === "guardian_crystal") {
    const hue = String(traits?.hue ?? "aurora");
    const key = (`guardian_${hue}`) as keyof typeof palettes;
    const [c1, c2, c3, c4] = palettes[key] ?? palettes.guardian_aurora;
    const facets = Number(traits?.facet ?? 8);
    const rank = String(traits?.rank ?? "seed");
    const rankIdx = ["seed", "founder", "guardian"].indexOf(rank);
    // More facets = slower spin, higher rank = stronger pulse
    const spinDur = slow + facets * 1.5;
    const pulseDur = [3, 2.2, 1.4][Math.max(0, rankIdx)];
    const moteCount = 4 + rankIdx * 2;
    return (
      <svg viewBox="0 0 100 100" className={className} aria-label="Guardian Crystal">
        <defs>
          <radialGradient id={`gc-bg-${tokenId}`} cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor={c2} /><stop offset="100%" stopColor={c1} />
          </radialGradient>
          <linearGradient id={`gc-body-${tokenId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c4} stopOpacity="0.9" />
            <stop offset="50%" stopColor={c3} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="14" fill={`url(#gc-bg-${tokenId})`} />
        <motion.circle cx="50" cy="50" r="32" fill={c3} opacity="0.2"
          animate={{ scale: [1, 1.1 + rankIdx * 0.05, 1], opacity: [0.1, 0.35 + rankIdx * 0.05, 0.1] }}
          transition={{ duration: pulseDur, repeat: Infinity }}
          style={{ transformOrigin: "50% 50%" }}
        />
        <motion.g
          animate={{ rotate: 360 * dir }}
          transition={{ duration: spinDur, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          {Array.from({ length: facets }).map((_, i) => {
            const a = (i * 360) / facets;
            return (
              <line key={i} x1="50" y1="50" x2="50" y2="20"
                stroke={c4} strokeWidth="0.6" opacity="0.4"
                transform={`rotate(${a} 50 50)`} />
            );
          })}
        </motion.g>
        <motion.g
          animate={{ y: [0, -2, 0], rotate: [-1, 1, -1] }}
          transition={{ duration: pulseDur * 1.2, repeat: Infinity }}
          style={{ transformOrigin: "50px 47px" }}
        >
          <polygon points="50,22 68,40 60,72 40,72 32,40"
            fill={`url(#gc-body-${tokenId})`} stroke={c4} strokeWidth="1.2" />
          <polygon points="50,22 60,40 50,46 40,40" fill="#ffffff" opacity="0.35" />
          <polygon points="40,40 50,46 40,72" fill={c4} opacity="0.25" />
          <polygon points="60,40 50,46 60,72" fill={c1} opacity="0.3" />
          {/* multiple shimmer lines for higher ranks */}
          {Array.from({ length: 1 + rankIdx }).map((_, i) => (
            <motion.line key={i}
              x1={40 + i * 6} y1={28 + i * 3} x2={46 + i * 6} y2={34 + i * 3}
              stroke="#ffffff" strokeWidth="2" strokeLinecap="round"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: pulseDur * 0.9, repeat: Infinity, delay: i * 0.4 }}
            />
          ))}
        </motion.g>
        <motion.g
          animate={{ rotate: -360 * dir }}
          transition={{ duration: spinDur * 0.55, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          {Array.from({ length: moteCount }).map((_, i) => {
            const a = (i * 360) / moteCount;
            return (
              <circle key={i} cx="50" cy="12" r={1.4 + rankIdx * 0.3} fill={c4}
                transform={`rotate(${a} 50 50)`} />
            );
          })}
        </motion.g>
      </svg>
    );
  }

  // Light Spark default — generative
  const [c1, c2, c3, ink] = pickSparkPalette(seed);
  const petals = 6 + Math.floor(seed2 * 4); // 6..9
  const aura = String(traits?.aura ?? "halo");
  const orbitCount = aura === "ripple" ? 5 : aura === "flame" ? 4 : 3;
  const petalDur = slow;            // seed-based spin speed
  const orbitDur = 6 + seed2 * 8;   // 6..14
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label="Light Spark">
      <defs>
        <radialGradient id={`ls-bg-${tokenId}`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </radialGradient>
        <radialGradient id={`ls-core-${tokenId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor={c3} />
          <stop offset="100%" stopColor={ink} stopOpacity="0.0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill={`url(#ls-bg-${tokenId})`} />
      <motion.g
        animate={{ rotate: 360 * dir }}
        transition={{ duration: petalDur, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "50% 50%" }}
      >
        {Array.from({ length: petals }).map((_, i) => {
          const a = (i * 360) / petals;
          return (
            <motion.ellipse
              key={i}
              cx="50" cy="22" rx="5" ry="14"
              fill={c3} opacity="0.55"
              transform={`rotate(${a} 50 50)`}
              animate={{ opacity: [0.4, 0.75, 0.4] }}
              transition={{ duration: fast * 1.5, repeat: Infinity, delay: i * 0.15 }}
            />
          );
        })}
      </motion.g>
      <motion.circle
        cx="50" cy="50" r="14" fill={`url(#ls-core-${tokenId})`}
        animate={{ scale: [1, 1.1 + seed * 0.2, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: fast, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "50% 50%" }}
      />
      <motion.g
        animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: blink, repeat: Infinity, times: [0, 0.88, 0.92, 0.96, 1] }}
        style={{ transformOrigin: "50px 49px" }}
      >
        <circle cx="46" cy="49" r="1.4" fill={ink} />
        <circle cx="54" cy="49" r="1.4" fill={ink} />
      </motion.g>
      <path d="M46 54 Q50 57 54 54" stroke={ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <motion.g
        animate={{ rotate: -360 * dir }}
        transition={{ duration: orbitDur, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "50% 50%" }}
      >
        {Array.from({ length: orbitCount }).map((_, i) => {
          const a = (i * 360) / orbitCount;
          return (
            <g key={i} transform={`rotate(${a} 50 50)`}>
              <circle cx="50" cy="14" r="2.4" fill="#fff" />
              <circle cx="50" cy="14" r="1.2" fill={c3} />
            </g>
          );
        })}
      </motion.g>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// Overlay layer: palette tint by user, trait-driven decorations
// ─────────────────────────────────────────────────────────────
const PALETTE_HUE: Record<string, number> = {
  dawn: 25, dusk: 295, forest: 130, ocean: 200, ember: 10, aurora: 165,
};
const GLYPH_PATHS: Record<string, string> = {
  moon:  "M88 14 a6 6 0 1 0 4 9 a4.5 4.5 0 1 1 -4 -9z",
  star:  "M90 10 l1.8 4 4.2 .4 -3.2 2.9 1 4.2 -3.8 -2.2 -3.8 2.2 1 -4.2 -3.2 -2.9 4.2 -.4z",
  leaf:  "M86 10 q10 0 10 10 q-10 0 -10 -10z",
  drop:  "M90 8 q4 6 4 9 a4 4 0 1 1 -8 0 q0 -3 4 -9z",
  flame: "M90 8 q3 4 1 7 q3 -1 3 3 a4 4 0 1 1 -8 0 q0 -4 4 -10z",
  eye:   "M84 14 q6 -5 12 0 q-6 5 -12 0z",
};

const renderConstellation = (code: string, tint: string, opacity: number) => {
  if (!code || code.length < 4) return null;
  // Map each char to deterministic position
  const pts = code.split("").slice(0, 4).map((ch, i) => {
    const v = ch.charCodeAt(0);
    return {
      x: 8 + ((v * 13) % 18) + i * 2,
      y: 70 + ((v * 7) % 22),
    };
  });
  return (
    <g opacity={opacity}>
      <polyline points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={tint} strokeWidth="0.4" strokeOpacity="0.6" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="0.8" fill={tint} />)}
    </g>
  );
};

const renderPattern = (pattern: string, tint: string, tokenId: number | string) => {
  const id = `pat-${tokenId}`;
  const stroke = { stroke: tint, strokeOpacity: 0.18, strokeWidth: 0.4, fill: "none" } as const;
  switch (pattern) {
    case "waves":
      return <g {...stroke}><path d="M0 30 Q25 22 50 30 T100 30" /><path d="M0 50 Q25 42 50 50 T100 50" /><path d="M0 70 Q25 62 50 70 T100 70" /></g>;
    case "rays":
      return <g {...stroke}>{Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1="50" y1="50" x2={50 + 60 * Math.cos((i * Math.PI) / 4)} y2={50 + 60 * Math.sin((i * Math.PI) / 4)} />
      ))}</g>;
    case "spiral":
      return <g {...stroke}><path d="M50 50 m0 -4 a4 4 0 1 1 -0.1 0 a8 8 0 1 1 0.1 0 a12 12 0 1 1 -0.1 0 a16 16 0 1 1 0.1 0" /></g>;
    case "lattice":
      return <g {...stroke}>{Array.from({ length: 5 }).map((_, i) => (
        <g key={i}><line x1={i * 25} y1="0" x2={i * 25} y2="100" /><line x1="0" y1={i * 25} x2="100" y2={i * 25} /></g>
      ))}</g>;
    case "bloom":
      return <g {...stroke}>{Array.from({ length: 6 }).map((_, i) => {
        const a = (i * 60 * Math.PI) / 180;
        return <ellipse key={i} cx={50 + 14 * Math.cos(a)} cy={50 + 14 * Math.sin(a)} rx="6" ry="14" transform={`rotate(${i * 60} ${50 + 14 * Math.cos(a)} ${50 + 14 * Math.sin(a)})`} />;
      })}</g>;
    default:
      return null;
  }
};

const renderAura = (intensity: number, tint: string) => {
  if (!intensity || intensity < 1) return null;
  return (
    <g style={{ mixBlendMode: "screen" }}>
      {Array.from({ length: Math.min(3, intensity) }).map((_, i) => (
        <circle key={i} cx="50" cy="50" r={42 + i * 4} fill="none" stroke={tint} strokeOpacity={0.18 - i * 0.04} strokeWidth={1.2} />
      ))}
    </g>
  );
};

const renderGlyph = (glyph: string, tint: string) => {
  const d = GLYPH_PATHS[glyph];
  if (!d) return null;
  return <path d={d} fill={tint} fillOpacity="0.75" />;
};

export const NftArtwork = (props: Props) => {
  const { collection, tokenId, traits, ownerId, className } = props;
  // User signature seed — same user shares hue across their NFT collection
  const userSeed = ownerId ? hash01(`u:${ownerId}`) : 0;
  // Hue rotation ±20° based on user; palette_variant adds collection-wide tint
  const variant = (traits?.palette_variant as string) || "";
  const variantHue = PALETTE_HUE[variant] ?? 0;
  // Combine: variant contributes most, user adds personal nudge
  const hueShift = Math.round(((variantHue + userSeed * 40 - 20) % 360 + 360) % 360);

  const pattern = (traits?.pattern as string) || "";
  const glyph = (traits?.accent_glyph as string) || "";
  const aura = Number(traits?.aura_intensity ?? 0);
  const constellation = (traits?.birth_constellation as string) || "";

  // Tint for overlays: derive from user seed so each user's marks look personal
  const userHue = Math.round(userSeed * 360);
  const overlayTint = `hsl(${userHue}, 70%, 65%)`;

  return (
    <div className={`relative ${className ?? ""}`} style={{ filter: hueShift ? `hue-rotate(${hueShift}deg)` : undefined }}>
      <NftArtworkBase collection={collection} tokenId={tokenId} traits={traits} className="block w-full h-full" />
      {(pattern || glyph || aura > 0 || constellation) && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {renderPattern(pattern, overlayTint, tokenId)}
          {renderAura(aura, overlayTint)}
          {renderGlyph(glyph, overlayTint)}
          {renderConstellation(constellation, overlayTint, 0.7)}
        </svg>
      )}
    </div>
  );
};
