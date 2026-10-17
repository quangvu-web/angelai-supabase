import { useState, useEffect, useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  Search,
  Folder,
  FileText,
  Download,
  Share2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Filter,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import angelAvatar from "@/assets/angel-avatar.png";

interface KnowledgeFolder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  is_processed: boolean;
  created_at: string;
  folder_id: string | null;
  extracted_content: string | null;
  metadata: any;
}

const Knowledge = () => {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null | "all">("all");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [readingDoc, setReadingDoc] = useState<KnowledgeDocument | null>(null);
  const [readPage, setReadPage] = useState(0);

  const READ_PAGE_SIZE = 1800;
  const readPages = useMemo(() => {
    const content = readingDoc?.extracted_content ?? "";
    if (!content) return [] as string[];
    const pages: string[] = [];
    let rest = content;
    while (rest.length > READ_PAGE_SIZE) {
      let cut = rest.lastIndexOf("\n", READ_PAGE_SIZE);
      if (cut < READ_PAGE_SIZE / 2) cut = rest.lastIndexOf(" ", READ_PAGE_SIZE);
      if (cut < READ_PAGE_SIZE / 2) cut = READ_PAGE_SIZE;
      pages.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) pages.push(rest);
    return pages;
  }, [readingDoc]);

  const openReadingDoc = (doc: KnowledgeDocument) => {
    setReadPage(0);
    setReadingDoc(doc);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        supabase.from("knowledge_folders").select("*").order("name"),
        supabase.from("knowledge_documents").select("*").order("created_at", { ascending: false }),
      ]);

      if (foldersRes.data) {
        setFolders(foldersRes.data);
        setExpandedFolders(new Set(foldersRes.data.map((f) => f.id)));
      }
      if (docsRes.data) {
        setDocuments(docsRes.data);
      }
    } catch (error) {
      console.error("Error fetching knowledge:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === "" ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFolder =
        selectedFolder === "all" ||
        (selectedFolder === null && doc.folder_id === null) ||
        doc.folder_id === selectedFolder;

      return matchesSearch && matchesFolder;
    });
  }, [documents, searchQuery, selectedFolder]);

  const getDocumentsInFolder = (folderId: string | null) => {
    return filteredDocuments.filter((d) => d.folder_id === folderId);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string, fileName: string) => {
    if (type.includes("pdf") || fileName.endsWith(".pdf")) return "📄";
    if (type.includes("word") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) return "📝";
    if (type.includes("text") || fileName.endsWith(".txt") || fileName.endsWith(".md")) return "📃";
    if (type.includes("image")) return "🖼️";
    return "📁";
  };

  const handleDownload = async (doc: KnowledgeDocument, format: "original" | "txt" = "original") => {
    toast.info(t("knowledge.downloadStarted"));
    
    try {
      if (format === "txt" && doc.extracted_content) {
        // Download as TXT using extracted content
        const blob = new Blob([doc.extracted_content], { type: "text/plain;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Replace original extension with .txt
        const txtFileName = doc.file_name.replace(/\.[^.]+$/, "") + ".txt";
        a.download = txtFileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Download original file
        const response = await fetch(doc.file_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download error:", error);
      // Fallback: open in new tab
      window.open(doc.file_url, "_blank");
    }
  };

  const handleShare = async (doc: KnowledgeDocument, action: string) => {
    const shareUrl = `${window.location.origin}/knowledge?doc=${doc.id}`;
    const shareText = `${doc.title} - ${t("knowledge.shareDescription")}`;

    // Copy actions
    if (action === "copy-link") {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Đã sao chép đường link tài liệu!");
      } catch {
        toast.error("Không thể sao chép");
      }
      return;
    }

    if (action === "copy-content") {
      if (doc.extracted_content) {
        try {
          const fullContent = `📚 ${doc.title}\n\n${doc.extracted_content}\n\n🔗 Xem tại: ${shareUrl}`;
          await navigator.clipboard.writeText(fullContent);
          toast.success("Đã sao chép toàn bộ nội dung tài liệu!");
        } catch {
          toast.error("Không thể sao chép");
        }
      } else {
        toast.error("Tài liệu này chưa được trích xuất nội dung");
      }
      return;
    }

    // Social share URLs
    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      zalo: `https://zalo.me/share?u=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      // FUN Ecosystem platforms - 10 official links
      "fun-profile": `https://angel.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-farm": `https://farm.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-charity": `https://charity.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-academy": `https://academy.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-play": `https://play.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-planet": `https://planet.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-wallet": `https://wallet.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "fun-treasury": `https://treasury.fun.rich/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "green-earth": `https://greenearth-fun.lovable.app/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
      "camly-coin": `https://camly.co/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(doc.title)}`,
    };

    if (shareUrls[action]) {
      window.open(shareUrls[action], "_blank");
      toast.success(t("knowledge.shareStarted"));
    }
  };

  const uncategorizedDocs = getDocumentsInFolder(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4">
          <div className="container mx-auto max-w-5xl flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
              <p className="text-foreground-muted">{t("common.loading")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <img
                  src={angelAvatar}
                  alt="Angel AI"
                  className="w-20 h-20 rounded-full shadow-lg animate-float"
                />
                <BookOpen className="absolute -bottom-1 -right-1 w-8 h-8 text-primary bg-white rounded-full p-1 shadow" />
              </div>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary-deep mb-2">
              {t("knowledge.title")}
            </h1>
            <p className="text-foreground-muted text-lg">{t("knowledge.subtitle")}</p>
          </div>

          {/* Search and Filter — single search box */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("knowledge.search")}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-primary-pale bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  {selectedFolder === "all"
                    ? t("knowledge.allFolders")
                    : selectedFolder === null
                    ? t("knowledge.uncategorized")
                    : folders.find((f) => f.id === selectedFolder)?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedFolder("all")}>
                  {t("knowledge.allFolders")}
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => setSelectedFolder(folder.id)}>
                    <Folder className="w-4 h-4 mr-2" />
                    {folder.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setSelectedFolder(null)}>
                  {t("knowledge.uncategorized")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-8 text-sm text-foreground-muted">
            <span>
              📁 {folders.length} {t("knowledge.allFolders").toLowerCase()}
            </span>
            <span>
              📄 {documents.length} {t("knowledge.documentsCount")}
            </span>
          </div>

          {/* Document List */}
          {filteredDocuments.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Sparkles className="w-12 h-12 text-primary/30 mx-auto mb-4" />
                <p className="text-foreground-muted">{t("knowledge.noDocuments")}</p>
              </CardContent>
            </Card>
          ) : selectedFolder === "all" ? (
            // Show by folders
            <div className="space-y-6">
              {folders.map((folder) => {
                const docsInFolder = getDocumentsInFolder(folder.id);
                if (docsInFolder.length === 0) return null;

                return (
                  <Card key={folder.id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 bg-primary-pale/30 cursor-pointer hover:bg-primary-pale/50 transition-colors"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      {expandedFolders.has(folder.id) ? (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-primary" />
                      )}
                      <Folder className="w-5 h-5 text-divine-gold" />
                      <span className="font-semibold text-primary-deep">{folder.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {docsInFolder.length}
                      </Badge>
                    </div>

                    {expandedFolders.has(folder.id) && (
                      <div className="divide-y divide-gray-100">
                        {docsInFolder.map((doc) => (
                          <DocumentItem
                            key={doc.id}
                            doc={doc}
                            onView={openReadingDoc}
                            onDownload={handleDownload}
                            onShare={handleShare}
                            formatFileSize={formatFileSize}
                            getFileIcon={getFileIcon}
                            t={t}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Uncategorized */}
              {uncategorizedDocs.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-gray-50">
                    <Folder className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-foreground-muted">
                      {t("knowledge.uncategorized")}
                    </span>
                    <Badge variant="secondary" className="ml-auto">
                      {uncategorizedDocs.length}
                    </Badge>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {uncategorizedDocs.map((doc) => (
                      <DocumentItem
                        key={doc.id}
                        doc={doc}
                            onView={openReadingDoc}
                        onDownload={handleDownload}
                        onShare={handleShare}
                        formatFileSize={formatFileSize}
                        getFileIcon={getFileIcon}
                        t={t}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            // Show filtered documents
            <Card className="overflow-hidden">
              <div className="divide-y divide-gray-100">
                {filteredDocuments.map((doc) => (
                  <DocumentItem
                    key={doc.id}
                    doc={doc}
                            onView={openReadingDoc}
                    onDownload={handleDownload}
                    onShare={handleShare}
                    formatFileSize={formatFileSize}
                    getFileIcon={getFileIcon}
                    t={t}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Reading modal — đọc nội dung ngay trên trang */}
      <Dialog open={!!readingDoc} onOpenChange={(open) => !open && setReadingDoc(null)}>
        <DialogContent className="w-screen h-[100dvh] max-w-none rounded-none sm:w-full sm:max-w-3xl sm:h-auto sm:max-h-[85vh] sm:rounded-lg flex flex-col p-4 sm:p-6 gap-3">
          <DialogHeader className="space-y-0">
            <div className="flex items-start gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 min-h-[44px]"
                onClick={() => setReadingDoc(null)}
              >
                <ArrowLeft className="w-4 h-4" />
                {t("knowledge.back")}
              </Button>
              <DialogTitle className="flex-1 text-left text-base sm:text-lg leading-snug pt-1.5">
                {readingDoc?.title}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {readPages.length > 0 ? (
              <p className="whitespace-pre-wrap text-base sm:text-[15px] leading-7 sm:leading-relaxed text-foreground">
                {readPages[Math.min(readPage, readPages.length - 1)]}
              </p>
            ) : (
              <p className="text-base text-foreground-muted">{t("knowledge.noContent")}</p>
            )}
            {readingDoc?.metadata?.media && readingDoc.metadata.media.length > 0 && (
              <div className="mt-4 space-y-3">
                {readingDoc.metadata.media.map((m) =>
                  m.type === "photo" || m.type === "image" ? (
                    <img
                      key={m.url}
                      src={m.url}
                      alt={readingDoc.title}
                      loading="lazy"
                      className="w-full rounded-lg border border-border"
                    />
                  ) : (
                    <a
                      key={m.url}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {m.url}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>
          {readPages.length > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 min-h-[44px]"
                disabled={readPage === 0}
                onClick={() => setReadPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                {t("knowledge.prevPage")}
              </Button>
              <span className="text-sm text-foreground-muted whitespace-nowrap">
                {t("knowledge.page")} {readPage + 1}/{readPages.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 min-h-[44px]"
                disabled={readPage >= readPages.length - 1}
                onClick={() => setReadPage((p) => Math.min(readPages.length - 1, p + 1))}
              >
                {t("knowledge.nextPage")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          {readingDoc?.file_url && (
            <div className="pt-2 border-t flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-h-[44px]"
                onClick={() => window.open(readingDoc.file_url, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
                {t("knowledge.viewSource")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

// Document Item Component
interface DocumentItemProps {
  doc: KnowledgeDocument;
  onView: (doc: KnowledgeDocument) => void;
  onDownload: (doc: KnowledgeDocument, format?: "original" | "txt") => void;
  onShare: (doc: KnowledgeDocument, action: string) => void;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (type: string, fileName: string) => string;
  t: (key: string) => string;
}

const DocumentItem = ({ doc, onView, onDownload, onShare, formatFileSize, getFileIcon, t }: DocumentItemProps) => {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
      <div className="text-2xl">{getFileIcon(doc.file_type, doc.file_name)}</div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(doc)}>
        <h3 className="font-medium text-foreground truncate hover:text-primary transition-colors">{doc.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-foreground-muted">
          <span>{formatFileSize(doc.file_size)}</span>
          <span>•</span>
          <span>{new Date(doc.created_at).toLocaleDateString("vi-VN")}</span>
          {doc.is_processed && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs py-0 h-5 text-green-600 border-green-200">
                ✓ {t("knowledge.filterProcessed")}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons - More prominent for users */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {/* View Button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-primary border-primary/30 hover:bg-primary/10 w-full sm:w-auto"
          onClick={() => onView(doc)}
          title={t("knowledge.readMore")}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">{t("knowledge.view")}</span>
        </Button>

        {/* Download Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-green-600 border-green-200 hover:bg-green-50 w-full sm:w-auto"
              title={t("knowledge.download")}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t("knowledge.download")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
              {t("knowledge.downloadFormat")}
            </div>
            <DropdownMenuItem onClick={() => onDownload(doc, "original")}>
              📄 {t("knowledge.downloadOriginal")}
            </DropdownMenuItem>
            {doc.extracted_content && (
              <DropdownMenuItem onClick={() => onDownload(doc, "txt")}>
                📝 {t("knowledge.downloadTxt")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
              title={t("knowledge.share")}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("knowledge.share")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Copy Options */}
            <div className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
              Sao chép
            </div>
            <DropdownMenuItem onClick={() => onShare(doc, "copy-link")}>
              🔗 Copy đường link tài liệu
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onShare(doc, "copy-content")}
              disabled={!doc.extracted_content}
              className={!doc.extracted_content ? "opacity-50 cursor-not-allowed" : ""}
            >
              📄 Copy toàn bộ nội dung
              {!doc.extracted_content && <span className="text-xs ml-1">(chưa có)</span>}
            </DropdownMenuItem>

            {/* Social Share */}
            <div className="px-2 py-1.5 text-xs font-semibold text-foreground-muted border-t mt-1 pt-2">
              Chia sẻ mạng xã hội
            </div>
            <DropdownMenuItem onClick={() => onShare(doc, "facebook")}>
              📘 Facebook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "twitter")}>
              🐦 Twitter/X
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "telegram")}>
              ✈️ Telegram
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "zalo")}>
              💬 Zalo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "whatsapp")}>
              💚 WhatsApp
            </DropdownMenuItem>
            
            {/* FUN Ecosystem */}
            <div className="px-2 py-1.5 text-xs font-semibold text-foreground-muted border-t mt-1 pt-2">
              FUN Ecosystem
            </div>
            <DropdownMenuItem onClick={() => onShare(doc, "fun-profile")}>
              🌟 FUN Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "fun-academy")}>
              📚 FUN Academy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(doc, "fun-life")}>
              💫 FUN Life
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Knowledge;
