import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Globe, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MintDestination = "angel_ai" | "fun_profile";

interface MintDestinationSelectorProps {
  value: MintDestination;
  onChange: (dest: MintDestination) => void;
  disabled?: boolean;
}

const destinations = [
  {
    id: "angel_ai" as MintDestination,
    label: "Mint trên Angel AI",
    icon: Zap,
    description: "Mint trực tiếp on-chain qua 3/3 Multisig",
    detail: "FUN Money sẽ được gửi thẳng vào ví của bạn sau khi GOV Attesters ký duyệt.",
    badge: "Trực tiếp",
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  {
    id: "fun_profile" as MintDestination,
    label: "Mint qua FUN Profile",
    icon: Globe,
    description: "Gộp vào epoch FUN Profile để mint",
    detail: "Điểm Light Score sẽ được chuyển sang FUN Profile và gộp vào epoch tiếp theo để mint. Phù hợp nếu bạn muốn tích lũy từ nhiều nền tảng FUN.",
    badge: "Gộp Epoch",
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
];

export function MintDestinationSelector({ value, onChange, disabled }: MintDestinationSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        Chọn cổng mint FUN Money
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {destinations.map((dest) => {
          const isSelected = value === dest.id;
          const Icon = dest.icon;
          return (
            <TooltipProvider key={dest.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-primary/40"
                    } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => !disabled && onChange(dest.id)}
                  >
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-medium ${
                            isSelected ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {dest.label}
                          </p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${dest.badgeColor}`}>
                            {dest.badge}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {dest.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-xs">
                  {dest.detail}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
