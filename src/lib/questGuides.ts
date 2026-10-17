// Hướng dẫn chi tiết cho từng quest code: chỗ làm + bằng chứng cần có.
// Map theo `quest_templates.code` để khớp với hook useDailyQuests.

export interface QuestGuide {
  whereLabel: string;       // VD: "Trang Cộng đồng"
  whereRoute: string;       // VD: "/community"
  steps: string[];          // 2-4 bước ngắn
  evidenceHint: string;     // gợi ý mô tả khi claim
  evidencePlaceholder?: string; // placeholder textarea
}

export const QUEST_GUIDES: Record<string, QuestGuide> = {
  Q_HELP_QUESTION: {
    whereLabel: "Cộng đồng → Hỏi đáp",
    whereRoute: "/community-questions",
    steps: [
      "Mở trang Hỏi đáp, chọn 1 câu hỏi chưa có câu trả lời tốt.",
      "Viết câu trả lời chân thành, đủ ý (≥ 50 ký tự).",
      "Quay lại /quest, dán link hoặc tóm tắt câu trả lời.",
    ],
    evidenceHint: "Tóm tắt câu trả lời bạn vừa viết hoặc dán link bài.",
    evidencePlaceholder: "Mình vừa trả lời câu hỏi về... (link/tóm tắt)",
  },
  Q_GRATITUDE: {
    whereLabel: "Cộng đồng → Đăng bài",
    whereRoute: "/community",
    steps: [
      "Mở Cộng đồng, bấm 'Đăng bài mới'.",
      "Viết 3 điều bạn biết ơn hôm nay (mỗi điều ≥ 1 câu).",
      "Đăng bài rồi quay lại /quest để claim.",
    ],
    evidenceHint: "Liệt kê 3 điều biết ơn bạn vừa đăng.",
    evidencePlaceholder: "Hôm nay mình biết ơn: 1)... 2)... 3)...",
  },
  Q_MEDITATE_5M: {
    whereLabel: "Pet Companion (hoặc tự thiền)",
    whereRoute: "/pet",
    steps: [
      "Ngồi yên 5 phút, hít thở chậm và sâu.",
      "Có thể mở /pet để trò chuyện cùng Pet trong khi tĩnh tâm.",
      "Quay lại /quest, mô tả cảm nhận sau 5 phút.",
    ],
    evidenceHint: "Mô tả ngắn cảm nhận sau khi thiền 5 phút.",
    evidencePlaceholder: "Sau 5 phút thiền, mình cảm thấy...",
  },
  Q_INVITE_FRIEND: {
    whereLabel: "Quest → Share Card",
    whereRoute: "/quest",
    steps: [
      "Bấm 'Copy link' ở thẻ 'Mời bạn cùng săn ánh sáng' ngay phía trên.",
      "Gửi link cho 1 người bạn mới (chưa có FUN ID).",
      "Khi bạn ấy đăng ký xong trong 24h, quest tự hoàn thành.",
    ],
    evidenceHint: "Cho biết bạn đã gửi link cho ai (tên/Telegram).",
    evidencePlaceholder: "Mình đã gửi link mời cho bạn... qua...",
  },
  Q_SHARE_LIGHT: {
    whereLabel: "Light Community",
    whereRoute: "/light-community",
    steps: [
      "Mở Light Community, đăng 1 câu chuyện ánh sáng (≥ 100 ký tự).",
      "Câu chuyện nên thật, mang năng lượng tích cực.",
      "Quay lại /quest, dán tiêu đề/tóm tắt để claim.",
    ],
    evidenceHint: "Tóm tắt câu chuyện ánh sáng bạn vừa chia sẻ.",
    evidencePlaceholder: "Mình vừa chia sẻ câu chuyện về...",
  },
  Q_COMMENT_KIND: {
    whereLabel: "Cộng đồng",
    whereRoute: "/community",
    steps: [
      "Mở Cộng đồng, đọc 3 bài viết khác nhau.",
      "Để lại 3 comment tích cực, cụ thể (không spam 'hay quá').",
      "Quay lại /quest mô tả ngắn 3 comment đó.",
    ],
    evidenceHint: "Tóm tắt 3 comment bạn vừa để lại.",
    evidencePlaceholder: "Mình comment bài của @... về...",
  },
  Q_POST_HONEST: {
    whereLabel: "Cộng đồng → Đăng bài",
    whereRoute: "/community",
    steps: [
      "Mở Cộng đồng, bấm 'Đăng bài mới'.",
      "Viết 1 chia sẻ thật lòng về 1 ngày của bạn (≥ 150 ký tự).",
      "Đăng bài rồi quay lại /quest để claim.",
    ],
    evidenceHint: "Tóm tắt nội dung bài bạn vừa đăng.",
    evidencePlaceholder: "Mình vừa đăng bài về...",
  },
  Q_LEARN_LESSON: {
    whereLabel: "Knowledge",
    whereRoute: "/knowledge",
    steps: [
      "Mở Knowledge, chọn 1 bài bạn chưa đọc.",
      "Đọc trọn vẹn (≥ 3 phút).",
      "Quay lại /quest viết 1-2 câu insight bạn rút ra.",
    ],
    evidenceHint: "Viết 1-2 câu insight từ bài Knowledge vừa đọc.",
    evidencePlaceholder: "Bài '...' giúp mình hiểu rằng...",
  },
  Q_TIP_FRIEND: {
    whereLabel: "FUN Profile → Gift",
    whereRoute: "/",
    steps: [
      "Mở profile của 1 người bạn (qua Cộng đồng hoặc Messages).",
      "Bấm nút Gift Camly, gửi ≥ 100 Camly kèm 1 lời nhắn.",
      "Quay lại /quest ghi tên người bạn vừa tặng.",
    ],
    evidenceHint: "Cho biết bạn vừa tặng Camly cho ai và bao nhiêu.",
    evidencePlaceholder: "Mình tặng @... 100 Camly vì...",
  },
  Q_PLAY_PET: {
    whereLabel: "Pet Companion",
    whereRoute: "/pet",
    steps: [
      "Mở /pet, gửi ≥ 3 tin nhắn cho Pet trong 3 phút.",
      "Quest tự đánh dấu hoàn thành — không cần bằng chứng.",
    ],
    evidenceHint: "Không cần bằng chứng — hệ thống tự ghi nhận.",
  },
  Q_OPEN_BOX: {
    whereLabel: "Inventory → Mystery Box",
    whereRoute: "/inventory",
    steps: [
      "Mở /inventory, vào tab Mystery Box.",
      "Bấm 'Mở' bất kỳ vé hộp nào bạn đang có.",
      "Quest tự hoàn thành — không cần bằng chứng.",
    ],
    evidenceHint: "Không cần bằng chứng — hệ thống tự ghi nhận.",
  },
  Q_HUNT_CLUE: {
    whereLabel: "Treasure Hunt",
    whereRoute: "/treasure",
    steps: [
      "Mở /treasure, chọn 1 manh mối (Clue) chưa giải.",
      "Nhập đáp án đúng (cooldown 10 phút/lần).",
      "Quest tự hoàn thành khi đáp án đúng.",
    ],
    evidenceHint: "Không cần bằng chứng — hệ thống tự ghi nhận.",
  },
};

export function getQuestGuide(code: string): QuestGuide | null {
  return QUEST_GUIDES[code] ?? null;
}
