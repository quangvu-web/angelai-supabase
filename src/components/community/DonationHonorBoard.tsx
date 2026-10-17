import { useState } from "react";
import { Heart, Sparkles, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useCoinGifts } from "@/hooks/useCoinGifts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { getProfilePath } from "@/lib/profileUrl";
import { motion } from "framer-motion";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";

export function DonationHonorBoard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { topDonors, allDonors, totalDonated } = useCoinGifts();
  const [showAllDialog, setShowAllDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isEmpty = topDonors.length === 0;

  const filteredDonors = allDonors.filter(d => 
    d.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="bg-white/30 backdrop-blur-sm rounded-xl border border-white/40 overflow-hidden shadow-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 px-4 py-3 relative overflow-hidden">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -right-4 -top-4 opacity-30"
          >
            <Sparkles className="w-20 h-20 text-white" />
          </motion.div>
          <div className="flex items-center gap-2 relative">
            <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <h3 className="font-bold text-white text-lg drop-shadow-sm">{t("donate.honorTitle")}</h3>
          </div>
          <div className="flex items-center gap-1.5 mt-1 relative">
            <img src={camlyCoinLogo} alt="coin" className="w-4 h-4 rounded-full" />
            <p className="text-sm text-white font-semibold drop-shadow-sm">
              {totalDonated.toLocaleString()} Camly Coin {t("donate.totalDonated")}
            </p>
          </div>
        </div>

        <div className="p-4">
          {isEmpty ? (
            <div className="text-center py-6">
              <Heart className="w-10 h-10 text-rose-300 mx-auto mb-2" />
              <p className="text-sm text-rose-600 font-medium">{t("donate.emptyState")}</p>
              <p className="text-xs text-rose-500 mt-1">{t("donate.beFirstDonor")}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* No rank badges - just gratitude list */}
              {topDonors.slice(0, 5).map((donor) => (
                <Link
                  key={donor.user_id}
                  to={getProfilePath(donor.user_id)}
                  className="flex items-center gap-3 hover:bg-rose-100/70 rounded-xl p-2.5 transition-all duration-200 hover:shadow-md group"
                >
                  <Avatar className="h-9 w-9 ring-2 ring-rose-200 shadow-md">
                    <AvatarImage src={donor.avatar_url || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-rose-200 to-pink-300 text-rose-700 font-bold">
                      {donor.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-semibold truncate group-hover:text-rose-600 transition-colors text-foreground">
                    {donor.display_name || "Mạnh thường quân"}
                  </span>
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400 flex-shrink-0" />
                </Link>
              ))}

              {/* View all - gratitude board, not ranking */}
              {allDonors.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllDialog(true)}
                  className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-100 mt-2"
                >
                  <span>Xem tất cả tri ân ({allDonors.length})</span>
                </Button>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-dashed border-rose-200">
            <p className="text-xs text-center text-rose-500 italic font-medium">
              ✨ {t("donate.appreciationMessage")} ✨
            </p>
          </div>
        </div>
      </div>

      {/* Gratitude Dialog - No ranks */}
      <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500">
            <DialogTitle className="text-white flex items-center gap-2">
              <Heart className="w-5 h-5 fill-white" />
              Bảng Tri Ân
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            <ScrollArea className="h-[50vh]">
              <div className="space-y-1.5 pr-3">
                {filteredDonors.map((donor) => {
                  const isCurrentUser = user?.id === donor.user_id;
                  return (
                    <Link
                      key={donor.user_id}
                      to={getProfilePath(donor.user_id)}
                      onClick={() => setShowAllDialog(false)}
                      className={`flex items-center gap-2.5 rounded-lg p-2 transition-all hover:shadow-sm
                        ${isCurrentUser ? 'bg-rose-100 ring-2 ring-rose-400' : 'hover:bg-rose-50'}`}
                    >
                      <Avatar className="h-8 w-8 ring-1 ring-rose-200">
                        <AvatarImage src={donor.avatar_url || ""} />
                        <AvatarFallback className="bg-rose-100 text-rose-700 text-xs">
                          {donor.display_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`flex-1 text-sm truncate ${isCurrentUser ? 'font-bold text-rose-800' : 'font-medium'}`}>
                        {donor.display_name || "Mạnh thường quân"}
                        {isCurrentUser && <span className="ml-1 text-xs text-rose-600">(Bạn)</span>}
                      </span>
                      <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300 flex-shrink-0" />
                    </Link>
                  );
                })}
                {filteredDonors.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Không tìm thấy kết quả</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
