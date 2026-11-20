# Phase 1 Verification Proof Report

- **Phase:** Phase 1 (`PRD-0` + Test Contract v1.0)
- **Target Tag:** `phase-1`
- **Verification Environment:** Windows 11, conda env `gen` (`D:\Coding\Anaconda\envs\gen`), Node.js `v26.13.1`, npm `11.20.0`
- **Command Run:** `npm run verify` (`tsc --noEmit && tsc -p tsconfig.cli.json && vitest run && node scripts/verify-phase1.mjs && vite build`)
- **Result:** **PASS (17/17 tests green, SHA-256 determinism verified, web & CLI builds green)**

---

## Requirement Traceability Matrix (PRD-0 & Test Contract v1.0)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` khớp 100% logic game | Unit test so sánh sâu `game.contract.json` vs `DEFAULT_TUNING` | `tests/contract.test.ts` (4/4 PASS) | **Đạt** |
| Chế độ headless 60Hz, đầy đủ cờ CLI & mã thoát `0 / 1 / 2` | Chạy CLI thật & unit test cờ sai / JSON lỗi / tick không tăng nghiêm ngặt | `tests/contract.test.ts`, `tests/scenarios.test.ts` | **Đạt** |
| Di chuyển theo `cam_yaw_deg` (dương & âm) + chuẩn hóa vector chéo `[1, 1]` | Unit test kiểm tra tọa độ sau 60 tick tại `yaw = 0°, 90°, -90°` và `[1, 1]` | `tests/engine.test.ts` | **Đạt** |
| Nhặt đom đóm (`pickup_radius = 1.8m`), giới hạn `carry_capacity = 10` | Unit test kiểm tra biên `<= 1.8`, không vượt 10, giữ mote dư trên đất | `tests/engine.test.ts` | **Đạt** |
| Nạp đèn (`interact_radius = 2.5m`), giữ phần dư, thắp sáng & thưởng thắng | Unit test + CLI scenario thắng (`scenario-win-run1.jsonl`, score `1110`) | `docs/proof/phase-1/scenario-win-run1.jsonl` | **Đạt** |
| Tỏa Sáng (`pulse_cost = 2`, cooldown `2.0s` = `120` tick nguyên, đẩy `6m`, stun `3s`) | Unit test kiểm tra thiếu sáng không phát event, edge trigger, cooldown chính xác 120 tick, 0 bóng mực | `tests/engine.test.ts` | **Đạt** |
| Vùng an toàn `safe_radius = 6.0m` quanh đèn đã thắp | Unit test kiểm tra đẩy Bóng Mực ra khi đèn mới sáng và giữ ngoài `> 6.0m` qua 60 tick | `tests/engine.test.ts` | **Đạt** |
| Bị Bóng Mực chạm (`hit_drop_ratio = 0.5`, `invuln_s = 1.5s`), thua `no_flames` & `dawn` | Unit test kiểm tra `floor(carried * 0.5)`, miễn thương, kết thúc `no_flames` và `dawn` | `tests/engine.test.ts` | **Đạt** |
| Thứ tự JSONL (tick 0 → events trước snapshot cùng tick → `end` cuối) | Kiểm tra tự động toàn bộ dòng JSONL của bản chạy CLI thật | `tests/scenarios.test.ts`, `docs/proof/phase-1/scenario-win-run1.jsonl` | **Đạt** |
| Tính tất định tuyệt đối (cả scenario tĩnh lẫn `random_motes/shades`) | Chạy CLI 2 lần độc lập và đối chiếu SHA-256 | `scripts/verify-phase1.mjs`: `win sha256=71f4056840b47095...`, `random sha256=a8d26c3970d078a5...` | **Đạt** |
| Tách biệt hoàn toàn `src/core/` & `src/render/` (sáng tạo không đổi headless) | `tsconfig.cli.json` biên dịch riêng `src/core` + `src/cli` với `types: ["node"]`, 0 import Three.js/DOM | `npm run build:cli` PASS + `npm run build:web` PASS (`dist/` built in 992ms) | **Đạt** |
| Review độc lập bởi agent khác người viết | Subagent `Phase 1 Independent Reviewer` kiểm toán độc lập, phát hiện & đã sửa 3 lỗi thực tế | Xem chi tiết trong `docs/notes/ai-log.md` | **Đạt** |

---

## Reproducible CLI Proof Artifacts
- [scenario-win-run1.jsonl](scenario-win-run1.jsonl) — 12 dòng JSONL đầy đủ (snapshot tick 0, 2 `mote_picked`, `deposit`, `lantern_lit`, `game_over` won, `end` score `1110`; SHA-256 `71f4056840b47095...`).
- [random-night1-run1.jsonl](random-night1-run1.jsonl) — 600 tick với `random_motes: true`, `random_shades: true`, seed `777` (SHA-256 `a8d26c3970d078a5...`).

## Original Lab Files Integrity Check
- 6 file gốc (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`): **0 thay đổi** (xác nhận qua `git status` và `scripts/verify-phase1.mjs`).
- Bản README sản phẩm lưu tại `README_review.md` chờ tác giả duyệt chốt tên.

