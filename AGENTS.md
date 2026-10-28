# AGENTS.md — Quy trình làm việc cho Codex trên repo Angelai Supabase

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Code copied from ANGEL AI imports routing helpers from `@/lib/router-compat` (react-router-style API on TanStack Router); keep using it instead of adding react-router-dom.
- `@/integrations/supabase/client` is an offline stub returning empty data, because the app is intentionally not connected to a database yet.
  - Lưu ý cập nhật 28/10/2026: ghi chú stub này đúng với `main` trước khi sửa auth. Khi nhánh sửa auth được merge, Codex phải cập nhật lại bullet này thành client thật, đừng để ghi chú cũ gây hiểu lầm.
- Root layout renders app providers inside `<ClientOnly>` because the copied code relies on browser-only APIs.

> Phần dưới đây là quy trình Codex thêm ngày 28/10/2026, giữ nguyên toàn bộ ghi chú gốc phía trên. Đặt file này ở GỐC repo, tên đúng `AGENTS.md` (chữ hoa). Codex trong VS Code sẽ tự đọc nó mỗi phiên, con không cần dán lại quy trình này trong từng lệnh nữa — mỗi lần chỉ cần giao NHIỆM VỤ cụ thể.
> File này chỉ áp dụng cho repo này. Nó không cho phép Codex đụng tới bất kỳ dự án hay repo nào khác.

## 0. Danh tính dự án — kiểm chứng trước mọi sửa đổi

- Repo GitHub: `quangvu-web/angelai-supabase`, nhánh mặc định `main`
- Dự án Lovable: `Angelai Supabase`, ID `845e762a-6e64-4fde-81ba-c4b3b0e86e3c`
- Bản live: `https://angelai-supabase.lovable.app`
- Supabase NGOÀI (không phải Lovable Cloud), ref `zghvgxwdpsapvuvvdgjl`
- Package manager: `bun` (khóa `bun.lock`, cấu hình `bunfig.toml`). KHÔNG dùng `npm install` để thay thế.

Trước khi sửa bất kỳ file nào, chạy và ghi nhận:

```bash
git remote -v
git status --short
git log -1 --oneline
```

Nếu remote không phải `quangvu-web/angelai-supabase`, hoặc HEAD không khớp với `main` mới nhất mà con đã xác nhận, thì DỪNG NGAY, hỏi lại, đừng sửa tiếp.

## 1. Nhánh — KHÔNG BAO GIỜ làm trực tiếp trên `main`

- Không commit, không push trực tiếp lên `main`. Không merge nhánh của mình vào `main`.
- Mỗi nhiệm vụ = một nhánh mới, tách từ `main` mới nhất:
  `codex/<nhiệm-vụ-ngắn>-<yyyymmdd>`, ví dụ `codex/fix-auth-20261028`
- Nếu lỡ đang ở `main` mà đã có thay đổi chưa commit (trường hợp trong ảnh chụp ngày 28/10), thì làm theo thứ tự này, KHÔNG commit lên `main`:
  ```bash
  git stash push -m "wip: <nhiệm vụ>"
  git checkout -b codex/<nhiệm-vụ>-<yyyymmdd>
  git stash pop
  git status --short
  ```
- Không `--force` lên nhánh chung, không rebase `main`, không xóa nhánh của người khác.

## 2. Phạm vi — sửa ít nhất có thể, đúng nhiệm vụ được giao

- Chỉ sửa các file mà nhiệm vụ nêu tên, hoặc file mà lỗi build/log chỉ thẳng vào.
- Không sửa format, không đổi tên, không dọn code không liên quan, không xóa file nếu nhiệm vụ không nói rõ xóa (nếu xóa, phải ghi lý do xóa trong báo cáo).
- Các vùng CẤM đụng tới nếu nhiệm vụ không nêu đích danh, và nêu đích danh thì vẫn cần con xác nhận riêng:
  - `supabase/config.toml` (giữ nguyên project đích)
  - `supabase/migrations/` (đã áp đủ lên database, không chạy lại, không sửa tay)
  - `supabase/functions/` đã deploy (sửa code function khác với deploy function — deploy là bước riêng)
  - `.env` và mọi giá trị key/secret trong đó
  - `src/pages/AuthCallback.tsx` (luồng SSO của FUN Profile, không phải callback Google)
  - Nội dung Luật Ánh Sáng, logic kiểm tra role admin
- Không tự ý nâng gói Supabase, tắt spend cap, bật/tắt Auth provider, Publish Lovable, hay tạo tài khoản test trong database.

## 3. Secrets — tuyệt đối không lộ, không commit

- KHÔNG in, KHÔNG dán, KHÔNG commit password, token, API key, private key, anon/publishable key, service key, mã OTP vào chat, code, commit message hay file nào trong repo.
- Chỉ được nhắc TÊN secret khi cần (ví dụ: "cần Client ID/Secret của Google"), không nhắc giá trị, không nhắc 4 ký tự đầu cũng không cần.
- Nếu nhiệm vụ cần một secret mới, DỪNG ở bước đó và ghi rõ: tên secret, nhập ở đâu (Supabase Dashboard / Google Cloud / form bảo mật), ai nhập. Đừng tự tạo secret rồi gửi lại cho con qua chat.

## 4. Build và kiểm chứng — không nhận vơ là pass

- Cài dependency đúng của dự án này:
  ```bash
  bun install --frozen-lockfile
  ```
  Nếu `bun` chưa có hoặc install kẹt, báo nguyên văn lỗi và thời gian đã chờ, đừng chuyển sang `npm install` rồi im lặng, đừng bảo "chắc là pass".
- Chạy build/test mà dự án có (ít nhất `bun run build`; thêm typecheck/lint nếu script có sẵn). Ghi kết quả NGUYÊN VĂN: pass, fail kèm lỗi, hoặc unverified kèm lý do (ví dụ: `vite: command not found` vì chưa có `node_modules`).
- Sau khi sửa, đọc lại file đã sửa và chạy:
  ```bash
  git diff --stat
  git diff
  ```
  Kiểm tra: không còn chuỗi lỗi cũ trong file đã sửa (ví dụ: với nhiệm vụ auth, không còn `lovable.auth.signInWithOAuth` trong `Auth.tsx`, không còn chuỗi "Chưa kết nối cơ sở dữ liệu" trong file auth đã sửa), không còn key hardcode, không còn import thừa.
- Sau 2 vòng sửa mà cùng một lỗi vẫn fail, DỪNG, báo bằng chứng từ code/log, đừng đoán mò vòng thứ 3 bằng cách sửa lan sang file khác.

## 5. Commit và push — chỉ đẩy nhánh, để Cha kiểm chứng

- Commit message tiếng Việt, rõ việc, ví dụ:
  `Sửa đăng nhập Supabase: khôi phục client thật, đổi Google sang Supabase OAuth`
- Chỉ push nhánh của mình:
  ```bash
  git push -u origin codex/<nhiệm-vụ>-<yyyymmdd>
  ```
  KHÔNG `git push origin main`, KHÔNG push kèm tag, KHÔNG tạo pull request rồi tự merge.
- Sau khi push, lấy và ghi vào báo cáo: SHA của commit mới, SHA base của `main` lúc tách nhánh, và link compare trên GitHub:
  `https://github.com/quangvu-web/angelai-supabase/compare/main...codex/<nhiệm-vụ>-<yyyymmdd>`

## 6. Báo cáo cuối — bắt buộc, tiếng Việt, theo đúng mẫu này

Codex phải kết thúc mỗi nhiệm vụ bằng một báo cáo theo mẫu sau, không viết chung chung kiểu "đã xong":

```text
NHIỆM VỤ: <tóm tắt 1 dòng>
NHÁNH: codex/<...> (base: <SHA main lúc tách>, mới: <SHA commit>)
LINK COMPARE: https://github.com/quangvu-web/angelai-supabase/compare/main...codex/<...>
FILE ĐỔI: <tên file> (+<số dòng thêm> -<số dòng bớt>) — ghi từng file
BUILD/TEST: pass / fail / unverified — kèm lỗi nguyên văn nếu fail/unverified
ĐÃ KIỂM CHỨNG: <đã đọc lại file nào, đã chạy lệnh nào, kết quả gì>
CHƯA KIỂM CHỨNG: <cái gì chưa làm được và vì sao>
KHÔNG LÀM: <các việc đã cố ý không đụng tới, ví dụ: không sửa migrations, không bật provider, không Publish>
BƯỚC TIẾP THEO CẦN NGƯỜI: <Publish? Bật Google provider ở Supabase Dashboard? Test email trước rồi mới test Google? Ghi rõ từng bước, đúng thứ tự>
RỦI RO / CẦN CHÚ Ý: <nếu có, nếu không thì ghi "Không có">
```

Quy tắc phân biệt trạng thái, không được lẫn:

- Đẩy nhánh lên GitHub ≠ đã merge vào `main`
- Merge vào `main` ≠ đã Publish lên Lovable
- Publish lên Lovable ≠ đã deploy lại Edge Function lên Supabase
- Chỉ được ghi "đã live" khi đã kiểm chứng trên bản live `https://angelai-supabase.lovable.app` sau bước Publish.

## 7. Cách con giao việc cho Codex từ nay

Con chỉ cần gửi nhiệm vụ ngắn, ví dụ:

> Sửa đăng nhập theo prompt ngày 28/10: khôi phục client Supabase thật, đổi Google sang Supabase OAuth, giữ nguyên AuthCallback của FUN Profile. Build phải pass, đẩy lên nhánh, báo cáo theo mẫu trong AGENTS.md.

Codex tự lo nhánh, build, commit, push và báo cáo. Cha (Muse) sẽ đọc nhánh đó trên GitHub, đối chiếu với `main`, và báo lại cho con trước khi merge hay Publish — con không cần gửi lại ảnh chụp màn hình hay copy log thủ công nếu Codex đã báo đủ theo mẫu trên.
