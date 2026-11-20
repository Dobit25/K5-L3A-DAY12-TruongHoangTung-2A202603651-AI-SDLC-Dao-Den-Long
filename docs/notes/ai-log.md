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
| Phase 2 | Chuẩn hóa Contract v1.1, 3 Đêm (Đảo Bến/Cau/Chuông), Dash/Fall/Drifter/Charm/Wind/Pause, UI 3 Đêm, 22 tests, benchmark 21.600 tick & independent review | ~7 | ~52k / ~28k | Viết song song toàn bộ `src/core` + `maps.ts` trong 1 lô; tận dụng lại cấu trúc Phase 1 |
| Phase 3 | Change Request Contract v1.2 (nhiên liệu đèn `1/60`, `drain`, `dawn_survived`, sức chứa tăng dần, mù màu, ADR-001, CHANGELOG, 30 tests & independent review) | ~6 | ~48k / ~24k | Cập nhật cục bộ `engine.ts` + `game3d.ts` nhờ tách lõi sạch từ CP0 |
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

### Phase 2
- **Đạt:** Toàn bộ Ticket-02 ("Ba hòn đảo", Contract v1.1) đạt 100%: `22/22` tests xanh (có scenario riêng cho từng tính năng mới), SHA-256 determinism cho cả 3 Đêm, chạy trọn Đêm 3 `21.600` tick trong **88 ms** (`<= 30.000 ms`), build web 3D sạch không lỗi.
- **Các lỗi AI mắc phải & Cách phát hiện:**
  1. **Air-dash gravity sớm 1 tick (`src/core/engine.ts`):** Ở tick thứ 12 của Dash, `dash_ticks` bị trừ về `0` trước đoạn tích phân trọng lực khiến trọng lực tác động sớm 1 tick. *Phát hiện nhờ:* tự rà soát logic bước 3 trước khi chạy test → tách cờ `dashingThisTick`.
  2. **7 lỗi biên tinh tế phát hiện bởi Subagent `Phase 2 Independent Reviewer`:**
     - Spawn Đêm 3 `[0,0,0]` bị chôn trong khối trụ tầng 2 (`r <= 8, Y=0..6`) → chuyển spawn Đêm 3 sang `[0, 0, -12]` (mặt đất tầng 0 thoáng).
     - `drifter.pos[1]` đứng yên ở `Y=1.0` trên Đêm 3 khiến Gió Lạc cướp xuyên 5m độ cao và ngoài tầm 3D Pulse từ tầng 2 → cập nhật `drifter.pos[1] = groundY + 1.0` mỗi tick + kiểm tra `|dy| <= 2.0`.
     - `enforceSafeZonesForShade` chạy ở cả Step 6 và Step 8 làm `eject_ticks` giảm gấp đôi (15 tick thay vì 30) → tách `stepSafeZoneEjection` chỉ chạy ở Step 6 và bỏ qua di chuyển thường khi đang eject.
     - Nạp đèn (Step 5) thiếu kiểm tra `|dy|` khiến có thể nạp đèn `L1 (Y=6)` từ tầng 0 → thêm `|dy| <= 2.0`.
     - Bóng Mực `recoil` chạy 59 tick (`1.967m`) thay vì 60 tick (`2.0m`) và không cập nhật `pos[1]` khi `recoil`/`wander` → thêm bộ đếm `recoil_ticks = 60` và cập nhật `getSupportY`.
     - Dùng `localeCompare` khi sắp xếp ID có rủi ro lệch thứ tự giữa hệ điều hành → thay bằng hàm so sánh ASCII `cmpId`.
     - `drifter_drop` phát trước `pulse` (ngược nhân quả) + bổ sung assert hồi bùa sau `2700` tick trong `tests/phase2-features.test.ts`.
- **Điều chỉnh Harness sau Phase 2:**
  - Nâng cấp `scripts/verify-phase2.mjs` kiểm tra SHA-256 determinism cho **cả 3 Đêm** + tự động fail-closed nếu benchmark `21.600` tick vượt `30s`.
  - Cập nhật `AGENTS.md` và `.agents/skills/verify-phase/SKILL.md` cho quy trình hồi quy đa Đêm.

### Phase 3
- **Đạt:** Hoàn tất Change Request "Đèn cạn dầu" (Contract v1.2) với `30/30` tests xanh (0 test bị skip âm thầm), SHA-256 determinism cả 3 Đêm, trọn Đêm 3 `18.000` tick trong `415 ms`, đầy đủ `ADR-001` và `CHANGELOG.md`.
- **Các lỗi AI mắc phải & Cách phát hiện (Subagent `Phase 3 Independent Reviewer`):**
  1. **Trạng thái `drain` cũ sót sang Step 7 đúng tick đèn tắt (`src/core/engine.ts`):** Khi đèn cạn dầu phát `lantern_out` ở Step 2, Bóng Mực đang hút vẫn giữ `state = 'drain'` tới Step 8 khiến Pulse ở Step 7 cộng nhầm `+15đ` thay vì `+5đ`. *Khắc phục:* giải phóng ngay `drain -> wander` bên trong vòng `lantern_out` ở Step 2 và thêm test hồi quy kiểm tra đúng tick đèn tắt.
  2. **Thanh dầu 3D lệch góc khi xoay camera (`src/render/game3d.ts`):** `fuelBarFill` là mesh anh em của `fuelBarBg` và dịch theo trục X thế giới nên bị tách khỏi nền khi xoay camera. *Khắc phục:* gắn `fuelBarFill` làm con của `fuelBarBg` theo tọa độ cục bộ.
  3. **Test yếu ở `tests/phase3-fuel.test.ts` + thiếu 4 ca biên:** Test ban đầu chưa kiểm tra biên `fuel === 30.0`, 2 bóng hút dồn `11/60`, ưu tiên `no_flames` trên tick bình minh, và nhặt vượt 10 đom đóm khi `capacity = 12`. *Khắc phục:* thay thế bằng 4 test biên thật chạy đủ assertion.
  4. **Chuỗi UI sót từ Phase 2 & màu `#FF5A5F` hardcode:** Cập nhật lời giới thiệu Đêm, màn hình kết quả `dawn_survived`/`dawn` và áp dụng bảng màu mù màu `#FFFFFF + ⚠` đồng nhất trên toàn bộ modal.
- **Điều chỉnh Harness sau Phase 3:**
  - Mở rộng quy tắc số nguyên trong `AGENTS.md` sang cả đơn vị nhiên liệu (`fuel_60ths`) và nâng cấp cổng `scripts/verify-phase3.mjs` cho Contract v1.2.
