import { AppLayout } from "@/components/layouts/AppLayout";
import { ProofUploadPanel } from "@/components/pplp/ProofUploadPanel";
import { useLanguage } from "@/contexts/LanguageContext";
import { Upload } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ProofUpload() {
  const { currentLanguage: language } = useLanguage();

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back link */}
          <Link to="/earn">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              {language === "vi" ? "Quay lại Earn" : "Back to Earn"}
            </Button>
          </Link>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-primary-deep flex items-center justify-center">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              {language === "vi" ? "Nộp Bằng Chứng" : "Submit Proof"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {language === "vi"
                ? "Đính kèm bằng chứng (link, ảnh, video, hoặc mô tả) cho các hành động đã nộp để được xác thực và nhận Light Score."
                : "Attach proof (links, images, video, or text) to submitted actions for validation and Light Score."}
            </p>
          </div>

          {/* Main panel */}
          <ProofUploadPanel />

          {/* Info */}
          <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              {language === "vi" ? "💡 Lưu ý:" : "💡 Notes:"}
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>{language === "vi" ? "Mỗi hành động cần ít nhất 1 bằng chứng để được chấm điểm" : "Each action needs at least 1 proof to be scored"}</li>
              <li>{language === "vi" ? "Bằng chứng được xác thực bởi AI + Cộng đồng + Hệ thống" : "Proof is validated by AI + Community + System"}</li>
              <li>{language === "vi" ? "Nếu bất kỳ trụ cột nào = 0, Light Score = 0 (Anti-fake)" : "If any pillar = 0, Light Score = 0 (Anti-fake)"}</li>
              <li>{language === "vi" ? "File tối đa 20MB (ảnh, video, PDF)" : "Max file size 20MB (images, video, PDF)"}</li>
            </ul>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
