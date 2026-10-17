import { Pet, PetEvolution } from "@/hooks/usePet";
import { motion } from "framer-motion";
import { PET_IMAGES } from "@/assets/pet-images";

const evolutionEmoji: Record<PetEvolution, string> = {
  spark: "✨", glow: "🌟", flame: "🔥", star: "⭐", sun: "☀️", cosmos: "🌌",
};
const elementColor: Record<string, string> = {
  fire: "from-orange-500/40 to-red-500/30",
  water: "from-sky-500/40 to-cyan-500/30",
  earth: "from-amber-700/40 to-yellow-700/30",
  air: "from-slate-300/40 to-violet-300/30",
  light: "from-yellow-300/40 to-amber-200/30",
};

const stageRing: Record<PetEvolution, string> = {
  spark: "ring-1 ring-primary/20",
  glow: "ring-2 ring-primary/40",
  flame: "ring-2 ring-primary/60 shadow-[0_0_18px_-2px_hsl(var(--primary)/0.45)]",
  star: "ring-[3px] ring-primary/70 shadow-[0_0_26px_-2px_hsl(var(--primary)/0.55)]",
  sun: "ring-4 ring-primary/80 shadow-[0_0_36px_-2px_hsl(var(--primary)/0.7)]",
  cosmos: "ring-4 ring-[#ffd700] shadow-[0_0_48px_-2px_#ffd70099]",
};
const stagePulse: Record<PetEvolution, number> = {
  spark: 0, glow: 0, flame: 0.4, star: 0.6, sun: 0.8, cosmos: 1,
};

export function PetAvatar({ pet, size = 96 }: { pet: Pet; size?: number }) {
  const pulse = stagePulse[pet.evolution];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {pulse > 0 && (
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-md"
          animate={{ scale: [1, 1.12, 1], opacity: [pulse * 0.5, pulse, pulse * 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div
        className={`relative rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${elementColor[pet.element]} ${stageRing[pet.evolution]}`}
        style={{ width: size, height: size }}
        aria-label={`Pet ${pet.name}`}
      >
        <img
          src={PET_IMAGES[pet.element][pet.evolution]}
          alt={pet.name}
          width={size}
          height={size}
          loading="lazy"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <span
          className="absolute bottom-0 right-0 leading-none drop-shadow"
          style={{ fontSize: size * 0.28 }}
          aria-hidden
        >
          {evolutionEmoji[pet.evolution]}
        </span>
      </div>
      {pet.evolution === "cosmos" && (
        <motion.div
          className="absolute -inset-1 rounded-full pointer-events-none opacity-70"
          style={{
            background:
              "conic-gradient(from 0deg, #b8860b, #daa520, #ffd700, #ffec8b, #ffd700, #daa520, #b8860b)",
            mask: "radial-gradient(circle, transparent 64%, black 66%, black 100%)",
            WebkitMask: "radial-gradient(circle, transparent 64%, black 66%, black 100%)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}
