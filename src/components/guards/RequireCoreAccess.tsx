import { ReactNode } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import { Button } from "@/components/ui/button";
import { smartBack } from "@/lib/smartBack";

/**
 * Khóa cứng: chỉ admin hoặc coordinator mới được vào /core/* và /cto/*.
 * User thường + guest đều bị chặn.
 */
export function RequireCoreAccess({ children }: { children: ReactNode }) {
  const { user, isAdmin, isAdminChecked, isLoading: authLoading } = useAuth();
  const { hasAccess: isCoordinator, isLoading: roleLoading } = useCoordinatorRole();
  const navigate = useNavigate();

  if (authLoading || (user && (!isAdminChecked || roleLoading))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cần đăng nhập</h1>
        <p className="text-muted-foreground mb-4">Khu vực Angel A.I. Core / CTO Console yêu cầu đăng nhập.</p>
        <Button onClick={() => navigate("/auth")}>Đăng nhập</Button>
      </div>
    );
  }

  if (!isAdmin && !isCoordinator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Khu vực hạn chế</h1>
        <p className="text-muted-foreground mb-4 max-w-md">
          Trang này chỉ dành cho <strong>Admin</strong> hoặc <strong>Coordinator</strong>.
          Vui lòng liên hệ admin nếu bạn cần quyền truy cập.
        </p>
        <Button variant="outline" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
