import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from "lucide-react";
import { useNftCollections } from "@/hooks/useNftCollections";
import { NftCatalogCard } from "./NftCatalogCard";
import { Button } from "@/components/ui/button";

interface Props {
  compact?: boolean;
  limit?: number;
}

export function NftCatalogGrid({ compact = false, limit }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useNftCollections();

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.length) return null;

  const items = limit ? data.slice(0, limit) : data;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((c) => (
          <NftCatalogCard key={c.code} c={c} />
        ))}
      </div>
      {compact && data.length > items.length && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/inventory#catalog")}
          className="w-full rounded-full"
        >
          Xem tất cả {data.length} bộ sưu tập →
        </Button>
      )}
    </div>
  );
}
