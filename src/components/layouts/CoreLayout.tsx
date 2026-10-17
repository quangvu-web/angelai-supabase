import { useRef } from "react";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MainSidebar } from "@/components/MainSidebar";
import { BackToTopButton } from "@/components/BackToTopButton";
import { SidebarProvider } from "@/components/ui/sidebar";
import CoreNavToolbar from "@/components/core/CoreNavToolbar";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import { Loader2 } from "lucide-react";

interface CoreLayoutProps {
  children: React.ReactNode;
  requireRole?: boolean;
}

export function CoreLayout({ children, requireRole = true }: CoreLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { user, isLoading: loading } = useAuth();
  const { hasAccess, isLoading } = useCoordinatorRole();

  if (requireRole) {
    if (loading || isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      );
    }
    if (!user) return <Navigate to="/auth" replace />;
    if (!hasAccess) return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden relative">
        <MainSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
          <Header />
          <CoreNavToolbar />
          <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hide">
            {children}
          </main>
        </div>
        <BackToTopButton scrollRef={mainRef} />
      </div>
    </SidebarProvider>
  );
}
