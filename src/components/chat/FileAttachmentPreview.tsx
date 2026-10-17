import { X, FileText, Music, Video, FileSpreadsheet, File, Code } from "lucide-react";

export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  url?: string;
  previewUrl?: string; // for images
}

const FILE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "text/plain": FileText,
  "text/csv": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "application/vnd.ms-excel": FileSpreadsheet,
};

const CODE_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".html", ".css", ".json", ".md",
  ".sol", ".yaml", ".yml", ".xml", ".go", ".rs", ".java", ".c", ".cpp",
  ".h", ".swift", ".kt", ".rb", ".php", ".sh", ".sql",
];

function isCodeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return CODE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function getFileIcon(type: string, name?: string) {
  if (type.startsWith("image/")) return null; // images show thumbnail
  if (type.startsWith("audio/")) return Music;
  if (type.startsWith("video/")) return Video;
  if (name && isCodeFile(name)) return Code;
  return FILE_ICONS[type] || File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentPreviewProps {
  file: AttachedFile;
  onRemove: () => void;
  isUploading?: boolean;
}

export function FileAttachmentPreview({ file, onRemove, isUploading }: FileAttachmentPreviewProps) {
  const isImage = file.type.startsWith("image/");
  const Icon = getFileIcon(file.type, file.name);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary-pale/50 rounded-lg border border-primary/20 max-w-xs">
      {isImage && file.previewUrl ? (
        <img src={file.previewUrl} alt={file.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
      ) : Icon ? (
        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          <File className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
        <p className="text-[10px] text-foreground-muted">
          {isUploading ? "Đang tải lên..." : formatFileSize(file.size)}
        </p>
      </div>
      <button
        onClick={onRemove}
        disabled={isUploading}
        className="p-1 rounded-full hover:bg-destructive/10 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5 text-foreground-muted hover:text-destructive" />
      </button>
    </div>
  );
}

/** Inline file card shown in message list */
export function FileMessageCard({ name, type, size, url }: { name: string; type: string; size: number; url: string }) {
  const Icon = getFileIcon(type, name) || File;
  const isImage = type.startsWith("image/");

  if (isImage) {
    return (
      <div className="rounded-xl overflow-hidden cursor-pointer max-w-xs" onClick={() => window.open(url, "_blank")}>
        <img src={url} alt={name} className="max-w-full rounded-xl" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-primary-pale/30 rounded-lg border border-primary/10 hover:bg-primary-pale/50 transition-colors max-w-xs"
    >
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{name}</p>
        <p className="text-[10px] text-foreground-muted">{formatFileSize(size)}</p>
      </div>
    </a>
  );
}
