import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass, Briefcase, Sparkles } from "lucide-react";
import { useValidatorMarketplace, type ValidatorSort } from "@/hooks/useValidatorMarketplace";
import { ValidatorCard } from "@/components/validators/ValidatorCard";
import { ValidatorFilters } from "@/components/validators/ValidatorFilters";
import { ValidatorPortfolioPanel } from "@/components/validators/ValidatorPortfolioPanel";
import { BecomeValidatorPanel } from "@/components/validators/BecomeValidatorPanel";
import { smartBack } from "@/lib/smartBack";

export default function Validators() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("explore");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<ValidatorSort>("top_stake");

  const { data: validators = [], isLoading } = useValidatorMarketplace({
    category: category === "all" ? null : category,
    sort,
    search,
    limit: 48,
  });

  return (
    <div className="container mx-auto max-w-5xl p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => smartBack(navigate)}
          className="min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-amber-500 to-yellow-400 bg-clip-text text-transparent truncate">
            Validator Marketplace
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
            Khám phá, ủng hộ, và trở thành validator của hệ sinh thái Trust
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0 sm:overflow-visible">
          <TabsList className="inline-flex sm:grid sm:w-full sm:grid-cols-3 whitespace-nowrap">
            <TabsTrigger value="explore" className="text-xs sm:text-sm min-h-[40px] px-3">
              <Compass className="h-3.5 w-3.5 mr-1" /> Khám phá
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs sm:text-sm min-h-[40px] px-3">
              <Briefcase className="h-3.5 w-3.5 mr-1" /> Danh mục
            </TabsTrigger>
            <TabsTrigger value="become" className="text-xs sm:text-sm min-h-[40px] px-3">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Trở thành
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="explore" className="space-y-4 mt-4">
          <ValidatorFilters
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            sort={sort}
            onSortChange={setSort}
          />
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-44 w-full animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : validators.length === 0 ? (
            <Card className="animate-fade-in">
              <CardContent className="p-10 sm:p-12 text-center space-y-3 flex flex-col items-center">
                <div className="rounded-full bg-muted p-4 text-muted-foreground">
                  <Compass className="h-8 w-8" />
                </div>
                <div className="font-semibold">Không tìm thấy validator phù hợp</div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Thử bỏ bộ lọc, đổi từ khoá, hoặc tự đăng ký làm validator để khởi đầu hệ sinh thái Trust.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-[40px]"
                  onClick={() => setTab("become")}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Trở thành validator
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {validators.map((v, i) => (
                <ValidatorCard key={v.did_id} v={v} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4 animate-fade-in">
          <ValidatorPortfolioPanel />
        </TabsContent>

        <TabsContent value="become" className="mt-4 animate-fade-in">
          <BecomeValidatorPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
