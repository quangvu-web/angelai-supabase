import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ExternalLink,
  History,
  Coins,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

interface ClaimRecord {
  id: string;
  amount: number;
  tx_hash: string;
  recipient_address: string;
  minted_at: string;
  created_at: string;
}

export function FUNClaimHistory() {
  const { user } = useAuth();
  const { currentLanguage: language } = useLanguage();
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("pplp_mint_requests")
        .select("id, amount, tx_hash, recipient_address, minted_at, created_at")
        .eq("actor_id", user.id)
        .eq("status", "minted")
        .not("tx_hash", "is", null)
        .order("minted_at", { ascending: false });

      if (!error && data) {
        setRecords(data as ClaimRecord[]);
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalClaimed = records.reduce((sum, r) => sum + r.amount, 0);
  const displayRecords = showAll ? records : records.slice(0, 5);

  const shortenHash = (hash: string) =>
    `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-500" />
          {language === "vi"
            ? "Lịch sử Claim FUN thành công"
            : "FUN Claim History"}
        </CardTitle>
        {records.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" />
              {language === "vi" ? "Tổng:" : "Total:"}{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {totalClaimed.toLocaleString()} FUN
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {records.length}{" "}
              {language === "vi" ? "giao dịch" : "transactions"}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>
              {language === "vi"
                ? "Chưa có giao dịch claim nào"
                : "No claim transactions yet"}
            </p>
            <p className="text-sm">
              {language === "vi"
                ? "Khi bạn claim FUN Money thành công, lịch sử sẽ hiển thị ở đây"
                : "Successful claims will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{record.amount.toLocaleString()} FUN
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {format(
                          new Date(record.minted_at),
                          "dd/MM/yyyy HH:mm"
                        )}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {shortenAddress(record.recipient_address)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-emerald-600 border-emerald-300 dark:border-emerald-700 text-[10px]"
                  >
                    ✓ On-chain
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      window.open(
                        `https://testnet.bscscan.com/tx/${record.tx_hash}`,
                        "_blank"
                      )
                    }
                    title={record.tx_hash}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {records.length > 5 && !showAll && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowAll(true)}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                {language === "vi"
                  ? `Xem thêm ${records.length - 5} giao dịch`
                  : `Show ${records.length - 5} more`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
