# Fix nút Nghe (Voice) + gọn nhóm nút phản hồi

## Phần 1 — Voice đọc câu trả lời

Chưa xác nhận được nguyên nhân chính xác (edge function `elevenlabs-tts` không có log gần đây), nên bước đầu tiên là chẩn đoán thật, rồi mới sửa.

1. **Chẩn đoán**: gọi thử `elevenlabs-tts` với một đoạn text ngắn, đọc log và mã lỗi trả về (hết hạn mức ElevenLabs, key sai, chặn quyền, hay lỗi phát audio phía trình duyệt).
2. **Sửa đúng gốc** theo kết quả bước 1, không xây hệ thống voice mới — vẫn dùng ElevenLabs sẵn có.
3. **Đọc đúng nội dung hiển thị**: chuẩn hóa văn bản trước khi gửi TTS — bỏ `#`, `**`, gạch đầu dòng, link, code block, HTML; không đọc ID, metadata, JSON hay dữ liệu kỹ thuật.
4. **Trạng thái nút**: bấm 🔊 → đang tải → đang đọc (bấm lại để dừng) → đọc xong tự trở về bình thường. Chỉ một câu trả lời được đọc tại một thời điểm.
5. **Dự phòng**: nếu ElevenLabs lỗi hoặc hết hạn mức trong ngày, tự chuyển sang giọng đọc của trình duyệt (miễn phí) kèm thông báo nhẹ, để nút không bao giờ "bấm mà không có gì xảy ra".

## Phần 2 — Dọn nút (phương án B)

Trong nhóm nút dưới mỗi câu trả lời:

- Giữ: 👍 Đúng, 👎 Chưa đúng
- Bỏ: ⚠️ Thông tin cũ, 📝 Cần bổ sung

Giữ nguyên các nút còn lại (Nghe, Sao chép, Chia sẻ, Lưu vào Knowledge).

## Chi tiết kỹ thuật

- `src/components/chat/MessageFeedback.tsx`: rút `FEEDBACK_OPTIONS` còn `like`/`dislike`; giữ nguyên bảng `chat_feedback` và logic upsert (dữ liệu cũ không bị ảnh hưởng).
- `src/hooks/useTextToSpeech.ts`: mở rộng `cleanTextForTTS`, xử lý lỗi rõ ràng theo mã trả về, thêm nhánh fallback `speechSynthesis`, đảm bảo `AudioContext`/`audio.play()` được gọi trong ngữ cảnh click (tránh bị autoplay policy chặn).
- `supabase/functions/elevenlabs-tts/index.ts`: chỉ sửa nếu chẩn đoán chỉ ra lỗi phía server (thông điệp lỗi rõ hơn khi hết hạn mức 30 lượt/ngày hoặc ElevenLabs trả 401/429).
- `src/components/chat/AudioButton.tsx`: giữ nguyên giao diện, chỉ chỉnh nhãn trạng thái nếu cần.
