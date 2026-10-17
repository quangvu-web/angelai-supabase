import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Droplets, ArrowRight } from "lucide-react";

export function CamlyFunRelationship() {
  const { currentLanguage: language } = useLanguage();
  const isVi = language === "vi";

  return (
    <Card className="border-0 bg-gradient-to-br from-amber-50/50 to-blue-50/50 dark:from-amber-950/20 dark:to-blue-950/20">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-semibold text-sm">
          {isVi ? "☀️ FUN Money & Camly Coin" : "☀️ FUN Money & Camly Coin"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* FUN Money */}
          <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-900/20 text-center space-y-2">
            <Sun className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">FUN Money</p>
            <p className="text-xs text-muted-foreground">
              {isVi ? "☀️ Mặt Trời — Tầm nhìn & Chuẩn giá trị" : "☀️ The Sun — Vision & Value Standard"}
            </p>
            <ul className="text-xs text-muted-foreground text-left space-y-1 mt-2">
              <li>• {isVi ? "Mint theo PLP" : "Minted via PLP"}</li>
              <li>• {isVi ? "Governance" : "Governance"}</li>
              <li>• {isVi ? "Giá trị dài hạn" : "Long-term value"}</li>
            </ul>
          </div>

          {/* Camly Coin */}
          <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-900/20 text-center space-y-2">
            <Droplets className="h-6 w-6 text-blue-500 mx-auto" />
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Camly Coin</p>
            <p className="text-xs text-muted-foreground">
              {isVi ? "💧 Dòng Nước — Nuôi hệ sinh thái" : "💧 The Stream — Ecosystem Nourishment"}
            </p>
            <ul className="text-xs text-muted-foreground text-left space-y-1 mt-2">
              <li>• {isVi ? "Utility nội bộ" : "Internal utility"}</li>
              <li>• {isVi ? "Phí tính năng" : "Feature fees"}</li>
              <li>• {isVi ? "Staking → Reputation" : "Staking → Reputation"}</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>FUN</span>
          <ArrowRight className="h-3 w-3" />
          <span>{isVi ? "dẫn đến đâu → Camly chạy theo đến đó" : "leads, Camly follows"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
