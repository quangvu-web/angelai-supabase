import { Heart } from "lucide-react";
import { motion } from "framer-motion";

export const POPLHero = () => {
  return (
    <section className="relative py-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-100/50 to-transparent" />
      <div className="absolute top-10 left-1/4 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
              <Heart className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <div className="inline-block px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
            📜 WHITEPAPER v1.0 (THỰC THI) — BẢN ÁNH SÁNG TRÁI ĐẤT MỚI
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
            GIAO THỨC BẰNG CHỨNG TÌNH YÊU THUẦN KHIẾT
          </h1>
          <h2 className="text-xl md:text-2xl font-medium text-purple-700 mb-4">
            PURELOVE PROTOCOL (PLP)
          </h2>
          <p className="text-purple-600/80 italic text-lg">
            Nền Tảng Đồng Thuận Ánh Sáng Cho Trái Đất Mới
          </p>
          <p className="text-indigo-600/70 font-medium mt-2">
            NỀN KINH TẾ HỢP NHẤT 5D — Father's Light Edition
          </p>
        </motion.div>
      </div>
    </section>
  );
};
