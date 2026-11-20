# Phase 2 Verification Proof Report

- **Phase:** Phase 2 (`Ticket-02 — "Ba hòn đảo"` + Test Contract v1.1)
- **Target Tag:** `phase-2`
- **Verification Environment:** Windows 11, conda env `gen` (`D:\Coding\Anaconda\envs\gen`), Node.js `v26.13.1`, npm `11.20.0`
- **Command Run:** `npm run verify` (`tsc --noEmit && tsc -p tsconfig.cli.json && vitest run && node scripts/verify-phase2.mjs && vite build`)
- **Result:** **PASS (22/22 tests green, Nights 1–3 SHA-256 determinism verified, 21,600-tick Night 3 = 88ms <= 30,000ms, web & CLI builds green)**

---

## Requirement Traceability Matrix (Ticket-02 & Test Contract v1.1)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.1 khớp 100% số liệu chuẩn Phần 1 | Deep-equality test `game.contract.json` vs `DEFAULT_TUNING` | `tests/contract.test.ts` (4/4 PASS) | **Đạt** |
| Hồi quy toàn bộ luật Phase 1 với số chuẩn v1.1 | Unit & CLI regression (di chuyển camera, nhặt, nạp, Tỏa Sáng, vùng an toàn, bị đánh, thua bình minh) | `tests/engine.test.ts` (6/6 PASS), `tests/scenarios.test.ts` (2/2 PASS) | **Đạt** |
| Thứ tự 12 bước trong 1 tick & trạng thái Bóng Mực chuẩn (`spawning/wander/chase/recoil/stunned`) | Kiểm toán độc lập + unit tests cho từng bước | `src/core/engine.ts`, `tests/engine.test.ts`, `tests/phase2-features.test.ts` | **Đạt** |
| Lướt / Dash (`14 m/s`, `12t`, giữ độ cao trên không, hồi `90t`) | Scenario headless riêng cho Dash | `tests/phase2-features.test.ts` | **Đạt** |
| Rơi khỏi đảo (`Y < -10`, bỏ qua bất tử, mất đom đóm, hồi sinh `60t` + `90t` bất tử) | Scenario headless riêng cho Fall | `tests/phase2-features.test.ts` | **Đạt** |
| Đêm 2 — Đảo Cau (2 đảo, cầu tre, 2 bục nhảy phóng ~1.4s sang đảo đích, 6 đèn) | Scenario headless bục nhảy Đêm 2 + chạy tất định CLI Đêm 2 | `tests/phase2-features.test.ts`, `docs/proof/phase-2/night2-run1.jsonl` | **Đạt** |
| Đêm 3 — Đảo Chuông (3 tầng, 2 dốc `30°/150°`, bục nhảy tầng 2, tháp chuông, gió `30s/5s/2m/s`, 7 đèn) | Scenario headless bục nhảy tầng 2 + gió mạnh tick 1800 + chạy tất định CLI Đêm 3 | `tests/phase2-features.test.ts`, `docs/proof/phase-2/night3-run1.jsonl` | **Đạt** |
| Gió Lạc (`idle -> chase -> drifter_steal -> flee`, Pulse thả `drifter_drop`) | Scenario headless Gió Lạc cướp (xuyên bất tử) + Pulse làm rơi lại đom đóm | `tests/phase2-features.test.ts` | **Đạt** |
| Bùa Gió (`7.2 m/s`, Lướt không hồi chiêu `600t`, hồi lại sau `2700t`) | Scenario headless Bùa Gió đầy đủ tới tick 2700 hồi bùa | `tests/phase2-features.test.ts` | **Đạt** |
| Tạm dừng / Tiếp tục (`paused`/`resumed`, `sim_tick` & timer đứng yên) | Scenario headless Pause/Resume | `tests/phase2-features.test.ts` | **Đạt** |
| Hiệu năng headless 1 Đêm đầy đủ (`21.600` tick `<= 30s`) | Benchmark CLI thực tế chạy trọn Đêm 3 | `scripts/verify-phase2.mjs`: **88 ms** (`<= 30,000 ms`) | **Đạt** |
| Tính tất định tuyệt đối cả 3 Đêm (SHA-256) | Chạy CLI 2 lần độc lập cho mỗi Đêm 1, 2, 3 | `N1=f24bf3a81bf529fc`, `N2=f9f6be2a13f9470b`, `N3=f6a228a0bb73faac` | **Đạt** |
| Giao diện 3D, chuỗi 3 Đêm, bảng màu chuẩn, cài đặt lưu `localStorage`, âm thanh, HUD đầy đủ | Build production `vite build` + kiểm tra mã nguồn `src/render/game3d.ts` & `src/render/audio.ts` | `dist/` built cleanly in `1.07s` *(đo FPS thực tế trên trình duyệt sẽ ghi thêm ở Phase 4 / video demo)* | **Đạt** *(FPS trình duyệt xác nhận thủ công khi quay demo)* |
| Review độc lập bởi agent khác người viết | Subagent `Phase 2 Independent Reviewer` phát hiện & đã sửa 7 lỗi biên trước khi chốt | Xem `docs/notes/ai-log.md` | **Đạt** |

---

## Reproducible CLI Proof Artifacts
- [night1-run1.jsonl](night1-run1.jsonl) — 1,800 ticks Đêm 1 (`sha256=f24bf3a81bf529fc...`, `164ms`)
- [night2-run1.jsonl](night2-run1.jsonl) — 1,800 ticks Đêm 2 (`sha256=f9f6be2a13f9470b...`, `108ms`)
- [night3-run1.jsonl](night3-run1.jsonl) — 1,800 ticks Đêm 3 (`sha256=f6a228a0bb73faac...`, `92ms`)
- [night3-full-21600.jsonl](night3-full-21600.jsonl) — 21,600 ticks trọn Đêm 3 (`88ms <= 30,000ms`)

