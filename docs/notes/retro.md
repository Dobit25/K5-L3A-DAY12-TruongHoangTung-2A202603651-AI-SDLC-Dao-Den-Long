# Project Retrospective — Day 12 AI SDLC: Đảo Đèn Lồng

- **Học viên:** TruongHoangTung — MSSV: `2A202603651` — Lớp: `K5-L3A`
- **Repo:** `K5-L3A-DAY12-TruongHoangTung-2A202603651-AI-SDLC-Dao-Den-Long`
- **Phạm vi hoàn thành:** CP0 → Phase 1 (`phase-1`, v1.0) → Phase 2 (`phase-2`, v1.1) → Phase 3 (`phase-3`, v1.2) → Phase 4 (`phase-4`, Release `v1.0.0`, v1.3)

---

## 1. Tổng hợp Evaluation 4 Phase

| Phase | Contract | Phạm vi cốt lõi | Kết quả Kiểm chứng (`npm run verify`) | Điểm nổi bật & Thay đổi |
|---|---|---|---|---|
| **CP0** | — | Dựng khung TS/Vite/Three.js/Node, `AGENTS.md`, skill `verify-phase`, CI GitHub Actions | `2/2` smoke tests PASS | Bảo toàn tuyệt đối 6 file gốc bằng hậu tố `_review`; cố định conda env `gen` |
| **Phase 1** | `v1.0` | Đêm 1 Đảo Bến, 5 đèn, nhặt/nạp/Pulse, Bóng Mực, headless CLI, 3D + Web Audio | `17/17` tests PASS · SHA-256 trùng khớp | Chuyển toàn bộ cooldown/timer sang **số nguyên theo tick** sau review độc lập |
| **Phase 2** | `v1.1` | Chuẩn hóa số liệu, 3 Đêm (Đảo Bến / Cau / Chuông), Dash, Fall, Gió Lạc, Bùa Gió, Gió mạnh, Pause, chuỗi 3 Đêm | `22/22` tests PASS · SHA-256 3 Đêm · `21.600` tick = `88 ms` | Bổ sung scenario riêng cho mọi tính năng mới; sửa 7 lỗi biên từ independent reviewer |
| **Phase 3** | `v1.2` | Change Request "Đèn cạn dầu": nhiên liệu nguyên `1/60`, châm dầu, `drain`, luật thắng `dawn_survived`, sức chứa `10..20`, mù màu | `30/30` tests PASS · SHA-256 3 Đêm · `18.000` tick = `415 ms` | Viết `ADR-001` & `CHANGELOG.md`; cập nhật mọi test cũ có ghi rõ lý do (0 skip âm thầm) |
| **Phase 4** | `v1.3` | Benchmark 1280×720 (`InstancedMesh`), Soak 10 Đêm, Bảng xếp hạng đĩa cục bộ + `--export-leaderboard`, Tiếp cận (đổi phím, phụ đề, giảm chuyển động, chữ `>= 18px`), Release `v1.0.0` | `33/33` tests PASS · `bench.json` (`avg_fps=3275.7`, `p1_low=1077.9`, `load_ms=1219`) · `soak.json` (`0` crash, `54.0 → 57.4 MB`, `0.5s`) | Đạt vượt mức mọi ngưỡng hiệu năng & ổn định |

---

## 2. Điều gì hiệu quả và chưa hiệu quả khi làm cùng AI

### Hiệu quả nhất
1. **Tách kiến trúc Core thuần Node.js (`src/core/`) khỏi Render (`src/render/`) ngay từ CP0:** Mọi thay đổi lớn ở Phase 2 (3 bản đồ địa hình) và Phase 3 (thay đổi hoàn toàn mô hình nhiên liệu & luật thắng) đều được triển khai và kiểm chứng trong `< 1.5s` bằng Vitest & CLI mà không cần mở trình duyệt.
2. **Viết giả định + tiêu chí nghiệm thu trước khi code (`docs/notes/assumptions.md`):** Khi chuyển sang Phase 3 (Change Request), việc đối chiếu bảng giả định cũ giúp xác định chính xác từng file test và từng quy tắc bị `[THAY THẾ]`, tránh sót logic ngầm.
3. **Subagent Reviewer độc lập (khác lượt viết code) ở cuối mỗi phase:** Đây là bước mang lại ROI chất lượng cao nhất trong toàn dự án — liên tục bắt được các lỗi thật mà bản thân agent viết code bỏ sót.
4. **Cổng kiểm chứng 1 lệnh fail-closed (`npm run verify`):** Biến việc kiểm tra typecheck, biên dịch CLI, unit tests, CLI e2e, SHA-256 determinism và build web thành thao tác tự động chỉ ~2–3 giây, loại bỏ hoàn toàn tâm lý "chắc là chạy rồi".

### Chưa hiệu quả / Khó khăn gặp phải
1. **Lệch kỳ vọng về môi trường chạy lệnh trên Windows PowerShell 5.1:** Ban đầu AI sinh chuỗi lệnh dùng `&&` gây lỗi cú pháp trên PowerShell 5.1; ngoài ra `conda.exe` và `.git/index.lock` bị sandbox chặn cần tách biệt rõ lệnh chạy.
2. **Đo RSS trong cùng tiến trình test runner (Vitest):** Lần chạy đầu của test Soak trong Vitest thất bại vì V8 nursery & parallel worker làm RSS nhảy `72.8 → 92.5 MB`. Chuyển sang chạy tiến trình CLI độc lập với JIT warmup Đêm 3 + `--expose-gc` + giảm cấp phát mảng tạm trong `step()` cho số đo trung thực và ổn định (`54.0 → 57.4 MB`).
3. **Thay đổi số liệu hàng loạt giữa Phase 1 → 2 → 3:** Do Phase 1 tự chọn số liệu còn Phase 2 chuẩn hóa và Phase 3 thay luật thắng, cần kỷ luật ghi lý do rõ khi cập nhật test cũ thay vì để test cũ cản trở hoặc tắt âm thầm.

---

## 3. Những lần AI sai, cách phát hiện và cải tiến Harness

| Phase | Lỗi AI mắc phải | Cách phát hiện | Cải tiến Harness / Code chống lặp lỗi |
|---|---|---|---|
| **CP0** | Dùng `&&` trên Windows PowerShell 5.1 | Chạy thật thất bại ngay lần đầu | Ghi quy tắc dùng `;` vào `AGENTS.md` |
| **Phase 1** | Trừ số thực `1/60` cho `invuln_s`/`pulse_cooldown_s`/`stun_s` gây dư `2.1e-15` lệch 1 tick | **Subagent Reviewer độc lập** kiểm toán `engine.ts` | Bổ sung quy tắc bắt buộc **Integer Tick Timers Only** vào `AGENTS.md` (áp dụng thành công cho cả `fuel_60ths` ở Phase 3!) |
| **Phase 1** | Đảo phím `A/D` trong 3D right-handed Three.js | **Subagent Reviewer độc lập** kiểm tra hệ trục camera | Sửa ánh xạ riêng ở `src/render/game3d.ts`, giữ nguyên 100% công thức Contract C ở `src/core/engine.ts` |
| **Phase 2** | 7 lỗi biên (spawn Đêm 3 lồng trong bệ tầng 2, `drifter.pos[1]` đứng yên ở `Y=1`, `eject_ticks` trừ 2 lần/tick, thiếu `|dy|` nạp đèn, `recoil` chạy 59 bước, `localeCompare` phụ thuộc OS) | **Subagent Reviewer độc lập** | Bổ sung hàm `cmpId` ASCII, tách `stepSafeZoneEjection`, mở rộng `scripts/verify-phase2.mjs` kiểm tra đủ 3 Đêm |
| **Phase 3** | Trạng thái `drain` cũ sót sang Step 7 đúng tick `lantern_out` gây cộng nhầm `+15đ` Pulse; thanh dầu 3D lệch khi xoay camera | **Subagent Reviewer độc lập** | Xóa ngay `drain` trong vòng `lantern_out`, gắn `fuelBarFill` làm con `fuelBarBg`, thêm 4 test biên `fuel===30` / `no_flames` trên tick bình minh |
| **Phase 4** | RSS test Soak dao động khi chạy chung worker Vitest | Chạy thật `npm run verify` báo FAIL `92.5 > 92.36` | Chạy `soak_cmd` bằng tiến trình độc lập + JIT warmup + `--expose-gc`, kiểm chứng ngưỡng chặt `<= 1.2×` |

---

## 4. Harness AI mang lại giá trị cao nhất

1. **`AGENTS.md` ngắn gọn (~45 dòng) tiến hóa theo từng phase:** Giữ ngữ cảnh nhỏ gọn nhưng ghi đúng những quy tắc đúc rút từ lỗi thật (tách Core/Render, cấm chạm 6 file gốc, chỉ dùng bộ đếm số nguyên theo tick, cấm tag khi `npm run verify` đỏ).
2. **Skill `.agents/skills/verify-phase/SKILL.md` + `npm run verify`:** Tạo thành cổng fail-closed bắt buộc trước mọi commit chốt phase; tự động sinh bằng chứng JSONL + SHA-256 thật không thể sửa tay.
3. **Subagent Independent Reviewer:** Đóng vai trò "cặp mắt thứ hai" tách khỏi lượt sinh code — phát hiện hơn **14 lỗi thật** (từ lỗi trôi float 1 tick tới lỗi hình học 3 tầng và thanh dầu 3D).
4. **GitHub Actions CI (`.github/workflows/ci.yml`):** Tự động chạy lại toàn bộ cổng `npm run verify` trên Linux (`ubuntu-latest`) mỗi khi push/tag, đảm bảo tính đa nền tảng cho máy chấm của giảng viên.

---

## 5. Tổng ước tính Token / Chi phí AI & Cách tiết kiệm

| Phase | Ước tính Input Tokens | Ước tính Output Tokens | Tổng ước tính | Chiến lược tiết kiệm áp dụng |
|---|---:|---:|---:|---|
| CP0 | ~22k | ~7k | ~29k | Đọc song song 6 file đề bài trong 1 lượt |
| Phase 1 | ~45k | ~22k | ~67k | Viết song song toàn bộ `src/core` theo lô; chốt giả định trước code |
| Phase 2 | ~52k | ~28k | ~80k | Tái sử dụng kiến trúc Phase 1; tách `maps.ts` riêng gọn gàng |
| Phase 3 | ~48k | ~24k | ~72k | Sửa cục bộ đúng vùng nhiên liệu/luật thắng, không viết lại cả repo |
| Phase 4 | ~55k | ~30k | ~85k | Tách riêng `benchmark.ts`, `soak.ts`, `leaderboard.ts`, `run-game.mjs` |
| **Tổng cộng** | **~222k** | **~111k** | **~333k** | Giữ `AGENTS.md` ngắn, gọi công cụ song song, chạy `npm run verify` 1 lệnh thay vì nhiều lượt thử sai |

---

## 6. Nếu làm lại từ đầu sẽ thay đổi điều gì

1. **Dùng `THREE.InstancedMesh` cho Đom Đóm và Bóng Mực ngay từ Phase 1** cả trong bản chơi chính lẫn bản benchmark để tối ưu draw-call ngay từ đầu và đồng nhất code render.
2. **Khởi tạo lớp trừu tượng địa hình (`maps.ts`) và bộ đếm tick nguyên ngay từ Phase 1:** Dù Phase 1 chỉ có 1 đảo phẳng, chuẩn bị sẵn interface `getSupportY` và integer tick counters sẽ giảm một nửa lượng refactor khi sang Phase 2–3.
3. **Bật sẵn Chrome remote debugging từ trước giờ lab** để agent có thể kiểm thử trực quan giao diện web và chụp ảnh màn hình chơi thực tế tự động ngay sau mỗi phase.
