import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export interface ProfileFilters {
  search: string;
  tier: string;
  sybil: string;
  sortBy: "tc" | "vs" | "bs" | "hs";
}

interface Props {
  filters: ProfileFilters;
  onChange: (f: ProfileFilters) => void;
  onExportCSV: () => void;
}

export function AdminProfileFilters({ filters, onChange, onExportCSV }: Props) {
  const set = (patch: Partial<ProfileFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="grid gap-2 md:grid-cols-5">
      <Input placeholder="Tìm DID..." value={filters.search} onChange={(e) => set({ search: e.target.value })} className="md:col-span-2" />
      <Select value={filters.tier || "all"} onValueChange={(v) => set({ tier: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả tier</SelectItem>
          {["T0","T1","T2","T3","T4"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.sybil || "all"} onValueChange={(v) => set({ sybil: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Sybil risk" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả risk</SelectItem>
          {["very_low","low","medium","high","critical"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Select value={filters.sortBy} onValueChange={(v) => set({ sortBy: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tc">Sort: TC</SelectItem>
            <SelectItem value="vs">Sort: VS</SelectItem>
            <SelectItem value="bs">Sort: BS</SelectItem>
            <SelectItem value="hs">Sort: HS</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={onExportCSV} title="Xuất CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
