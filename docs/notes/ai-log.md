# AI Usage Log, Error Analysis & Token Tracking

> Theo dõi quy trình làm việc cùng AI qua các phase: lỗi AI phát hiện được, chỉnh sửa harness để chống lặp lỗi, và ước tính token/chi phí + chiến lược tiết kiệm token.

---

## Tổng quan Token & Chiến lược tiết kiệm
- **Chiến lược tiết kiệm token áp dụng liên tục:**
  1. Giữ `AGENTS.md` ngắn gọn (~45 dòng) để không phình context ở mọi lượt chạy.
  2. Tách biệt kiến trúc `src/core/` (thuần logic) khỏi `src/render/` (Three.js) giúp đọc/sửa cục bộ, không phải nạp lại toàn bộ dự án.
  3. Chốt giả định + kế hoạch kiểm chứng trước khi sinh code để giảm vòng lặp sửa lại.
  4. Gộp toàn bộ kiểm chứng vào 1 lệnh `npm run verify` (typecheck + build CLI + 17 tests + SHA-256 determinism + build web).

| Phase | Công việc chính | Số lượt ước tính | Ước tính Token (In / Out) | Ghi chú tiết kiệm token |
|---|---|---:|---:|---|
| CP0 | Khảo sát repo, dựng harness, tài liệu nền, cài deps | ~6 | ~22k / ~7k | Đọc song song 6 file đề bài & tạo toàn bộ file CP0 theo lô |
| Phase 1 | Triển khai PRD-0 + Test Contract v1.0, game 3D, audio, 17 tests, independent review & sửa lỗi | ~8 | ~45k / ~22k | Viết song song toàn bộ `src/core` trong 1 lượt; tách reviewer độc lập chỉ đọc file liên quan |
| Phase 2 | *(Chờ triển khai)* | — | — | — |
| Phase 3 | *(Chờ triển khai)* | — | — | — |
| Phase 4 | *(Chờ triển khai)* | — | — | — |

---

## Nhật ký đánh giá & Phân tích lỗi AI theo Phase

### CP0
- **Đạt:** Bảo toàn tuyệt đối 6 file gốc bằng quy ước `_review`, cấu hình remote repo cá nhân, xác định conda env `gen` (`D:\Coding\Anaconda\envs\gen`), dựng harness (`AGENTS.md`, skill `verify-phase`, CI GitHub Actions).
- **Sự cố & Xử lý:**
  1. PowerShell 5.1 báo lỗi cú pháp khi dùng `&&` để nối lệnh → cập nhật `AGENTS.md` yêu cầu dùng `;` trên Windows PowerShell 5.1.
  2. Chrome chưa bật remote debugging nên browser subagent không đọc được Lab board → dừng ngay, không đoán yêu cầu, xin người dùng dán nguyên văn PRD-0 + Test Contract.

### Phase 1
- **Đạt:** Toàn bộ yêu cầu PRD-0 và Test Contract v1.0 đạt 100% (`17/17` tests xanh, SHA-256 determinism khớp từng byte, bản 3D + âm thanh procedural build sạch không lỗi, tách biệt tuyệt đối khỏi `src/core/`).
- **Các lỗi AI mắc phải & Cách phát hiện:**
  1. **Lỗi timing trong scenario mẫu (`tests/fixtures/phase1-win-scenario.json`):** Lần chạy `npm run verify` đầu tiên báo `FAIL` (`expected 'lost' to be 'won'`) vì đặt `S1` ở `z=18` khiến Bóng Mực chạm Mây ở tick 113 ngay trước khi kịp nạp đèn ở tick 115. *Phát hiện nhờ:* chạy thật CLI scenario thay vì chỉ tin mô tả.
  2. **Lỗi trôi dấu phẩy động ở timer (`invuln_s`, `pulse_cooldown_s`, `stun_s`) trong `src/core/engine.ts`:** Trừ liên tục `1/60` bằng số thực IEEE-754 để lại dư dương `~2.1e-15` sau đúng `120` tick khiến cooldown kéo dài thành `121` tick thay vì `120`, đồng thời `stun_s` bị trừ ngay trong cùng tick vừa stun. *Phát hiện nhờ:* **Subagent `Phase 1 Independent Reviewer`** đọc kiểm toán độc lập! *Khắc phục:* chuyển toàn bộ timer sang bộ đếm **số nguyên theo tick** (`invuln_ticks`, `pulse_cooldown_ticks`, `stun_ticks`) + thêm test hồi quy kiểm tra chính xác tick thứ `120`/`121` và bổ sung quy tắc "integer tick timers" vào `AGENTS.md`.
  3. **Lỗi đảo phím A/D trong góc nhìn 3D (`src/render/game3d.ts`):** Camera nhìn về `+Z` trong không gian right-handed Three.js nên `-X` là bên phải màn hình, khiến phím `D` (`mx += 1`) làm nhân vật đi sang trái. *Phát hiện nhờ:* **Subagent `Phase 1 Independent Reviewer`**. *Khắc phục:* đảo ánh xạ `KeyA`/`KeyD` trong `src/render/game3d.ts` (giữ nguyên 100% công thức `src/core/engine.ts` theo Contract C).
  4. **Lỗi biên nhỏ ở CLI & scenario:** `Number("") === 0` chấp nhận cờ rỗng như `--seed ""`, và `scenario.motes` chưa tiền-nạp `usedIds` tránh trùng ID. *Phát hiện nhờ:* Independent Reviewer. *Khắc phục:* siết chặt `parseStrictInt`, hỗ trợ `--flag=value`, tiền-nạp `usedIds`, và thêm test hồi quy trong `tests/contract.test.ts`.
- **Điều chỉnh Harness sau Phase 1:**
  - Thêm kiểm tra tự động `game.contract.json === DEFAULT_TUNING` trong `tests/contract.test.ts`.
  - Gắn cổng kiểm tra SHA-256 determinism (`scripts/verify-phase1.mjs`) trực tiếp vào `npm run verify`.
  - Cập nhật `AGENTS.md` quy định dùng **integer tick counters** cho mọi cooldown/timer trong `src/core/` để lỗi trôi float không bao giờ tái diễn ở Phase 2–4.
