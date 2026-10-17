import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { ValidatorSort } from "@/hooks/useValidatorMarketplace";

const CATEGORIES = [
  { value: "all", label: "Tất cả" },
  { value: "community", label: "Community" },
  { value: "dao", label: "DAO" },
  { value: "business", label: "Business" },
  { value: "edu", label: "Education" },
];

const SORTS: { value: ValidatorSort; label: string }[] = [
  { value: "top_stake", label: "Stake cao nhất" },
  { value: "most_active", label: "Hoạt động nhiều nhất" },
  { value: "best_uptime", label: "Uptime tốt nhất" },
  { value: "newest", label: "Mới nhất" },
];

export function ValidatorFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  sort: ValidatorSort;
  onSortChange: (v: ValidatorSort) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm validator theo tên hoặc slug..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(v) => onSortChange(v as ValidatorSort)}>
        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
