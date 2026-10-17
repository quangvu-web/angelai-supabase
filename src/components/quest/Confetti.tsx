import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#ffd700", "#daa520", "#b8860b", "#ffec8b", "#a78bfa", "#3b82f6"];

export default function Confetti({ show, count = 60 }: { show: boolean; count?: number }) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {Array.from({ length: count }).map((_, i) => {
            const x = Math.random() * 100;
            const delay = Math.random() * 0.3;
            const duration = 1.4 + Math.random() * 1.2;
            const rotate = Math.random() * 720 - 360;
            const color = COLORS[i % COLORS.length];
            const size = 6 + Math.random() * 8;
            return (
              <motion.div
                key={i}
                initial={{ y: -20, x: `${x}vw`, opacity: 1, rotate: 0 }}
                animate={{ y: "110vh", rotate, opacity: [1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration, delay, ease: "easeIn" }}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  background: color,
                  borderRadius: i % 3 === 0 ? "50%" : "2px",
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
