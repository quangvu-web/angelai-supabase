import { useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { smartBack } from "@/lib/smartBack";

export const POPLHeader = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-purple-200/50">
      <div className="container mx-auto px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-purple-700 hover:bg-purple-100" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              PURELOVE PROTOCOL (PLP)
            </h1>
            <p className="text-xs text-purple-600/70">Whitepaper v1.0 — Genesis Release</p>
          </div>
        </div>
      </div>
    </header>
  );
};
