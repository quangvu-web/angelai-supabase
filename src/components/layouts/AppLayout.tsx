import { useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MainSidebar } from "@/components/MainSidebar";
import { BackToTopButton } from "@/components/BackToTopButton";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Whether to show footer (default: true) */
  showFooter?: boolean;
}

export function AppLayout({ children, showFooter = true }: AppLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden relative">
        {/* Left Sidebar - Navigation */}
        <MainSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
          <Header />

          {/* Scrollable content */}
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto scrollbar-hide"
          >
            {children}
            {showFooter && <Footer />}
          </main>
        </div>

        <BackToTopButton scrollRef={mainRef} />
      </div>
    </SidebarProvider>
  );
}
