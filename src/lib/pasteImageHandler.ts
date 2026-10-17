/**
 * Trích xuất các tệp ảnh từ ClipboardEvent (hỗ trợ copy-paste ảnh).
 * Trả về danh sách File ảnh (kèm tên có timestamp nếu clipboard không cung cấp tên).
 */
export function extractImagesFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File[] {
  const clipboardData = (e as ClipboardEvent).clipboardData || (e as React.ClipboardEvent).clipboardData;
  if (!clipboardData) return [];

  const files: File[] = [];
  const items = clipboardData.items;
  if (!items) return files;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        // Một số trình duyệt đặt tên là "image.png" hoặc rỗng — gắn timestamp để tránh trùng
        const ext = file.type.split("/")[1] || "png";
        const namedFile = new File(
          [file],
          file.name && file.name !== "image.png"
            ? file.name
            : `pasted-${Date.now()}-${i}.${ext}`,
          { type: file.type }
        );
        files.push(namedFile);
      }
    }
  }

  return files;
}
