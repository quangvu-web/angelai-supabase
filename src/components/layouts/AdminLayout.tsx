import { Header } from "@/components/Header";
import { MainSidebar } from "@/components/MainSidebar";
import { BackToTopButton } from "@/components/BackToTopButton";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import { useRef } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden relative">
        {/* Left Sidebar - Navigation */}
        <MainSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
          <Header />
          <AdminNavToolbar />

          {/* Scrollable content */}
          <main
            ref={mainRef}
            className="flex-1 overflow-y-auto scrollbar-hide"
          >
            {children}
          </main>
        </div>

        <BackToTopButton scrollRef={mainRef} />
      </div>
    </SidebarProvider>
  );
}
