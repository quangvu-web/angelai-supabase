import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { SbtQueueItem } from "@/hooks/useZkAndOnchain";

export function OnChainStatusBadge({ item }: { item: SbtQueueItem | null | undefined }) {
  if (!item) {
    return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Off-chain</Badge>;
  }
  if (item.status === "minted" && item.tx_hash) {
    const explorer = item.network === "bsc-testnet" ? "https://testnet.bscscan.com" : "https://bscscan.com";
    return (
      <a
        href={`${explorer}/tx/${item.tx_hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <CheckCircle2 className="h-3 w-3" /> On-chain <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  if (item.status === "processing") {
    return <Badge variant="secondary" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
  }
  if (item.status === "failed") {
    return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
  }
  return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
}
