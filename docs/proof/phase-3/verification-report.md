# Phase 3 Verification Proof Report

- **Phase:** Phase 3 (`Ticket-03 — Change Request "Đèn cạn dầu"` + Test Contract v1.2)
- **Target Tag:** `phase-3`
- **Verification Environment:** Windows 11, conda env `gen` (`D:\Coding\Anaconda\envs\gen`), Node.js `v26.13.1`, npm `11.20.0`
- **Command Run:** `npm run verify` (`tsc --noEmit && tsc -p tsconfig.cli.json && vitest run && node scripts/verify-phase3.mjs && vite build`)
- **Result:** **PASS (30/30 tests green, Nights 1–3 SHA-256 determinism verified, 18,000-tick Night 3 = 415ms <= 30,000ms, web & CLI builds green)**

---

## Requirement Traceability Matrix (Ticket-03 & Test Contract v1.2)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.2 khớp 100% số liệu mới (`fuel_*`, `relight_cost`, `win_ratio`, `capacity_max`, `240/270/300s`) | Deep-equality test `game.contract.json` vs `DEFAULT_TUNING` | `tests/contract.test.ts` (4/4 PASS) | **Đạt** |
| Nhiên liệu đèn nguyên `1/60`, hao `1/60` mỗi tick, tắt phát `lantern_out`, thắp lại `5` đom đóm (`+40đ`, `relight: true`, `relit_count++`) | Unit scenario kiểm tra chính xác tick 59/60, tắt & thắp lại | `tests/phase3-fuel.test.ts` | **Đạt** |
| Châm dầu `min(carried, ceil((100 - fuel)/10))`, châm từ `< 30` lên `>= 30` đẩy Bóng Mực trong `<= 30` tick | Unit scenario châm dầu + đẩy Bóng Mực ra khỏi vùng 6m | `tests/phase3-fuel.test.ts` | **Đạt** |
| Biên `fuel === 30` giữ vùng an toàn; `< 30` mất vùng an toàn, Bóng Mực `wander` chọn đèn yếu gần nhất, `drain` hút `5/60` (cộng dồn `11/60`), `fuel_drain` mỗi 60 tick, Pulse `+15đ` | Unit scenarios kiểm tra biên `30.0`, 2 bóng hút dồn `11/60`, `drain -> chase` ở `<= 6m`, Pulse `+15đ` vs `+5đ` lúc `lantern_out` | `tests/phase3-fuel.test.ts` | **Đạt** |
| Luật thắng mới `dawn_survived` (`>= 60%` đèn sáng lúc bình minh), bỏ thắng sớm `all_lit`, ưu tiên `no_flames` ngay cả đúng tick bình minh | Unit tests & CLI e2e scenario (`end.score = 705`, `reason: dawn_survived`) | `tests/phase3-fuel.test.ts`, `tests/engine.test.ts`, `tests/scenarios.test.ts` | **Đạt** |
| Sức chứa tăng dần `min(20, 10 + 2 * successful_lights)` (không tính đèn đặt sẵn scenario) | Unit test kiểm tra tăng `10 -> 12`, nhặt được 12 đom đóm, trần `20` | `tests/phase3-fuel.test.ts` | **Đạt** |
| Chế độ mù màu (`#00B3FF`, `#FFFFFF + ⚠`), đèn tắt xẹp 20% + vết rách, thanh dầu 3D + nhấp nháy 1 Hz | Kiểm tra mã nguồn & build production `vite build` | `src/render/game3d.ts`, `dist/` built cleanly in `1.99s` | **Đạt** |
| Tài liệu DoD: ADR thiết kế + Changelog breaking changes + test cũ cập nhật có lý do | Rà soát file ADR, Changelog và comment lý do trong mọi file test đã cập nhật | `docs/notes/adr-001-lantern-fuel-and-dawn-survival.md`, `CHANGELOG.md`, `tests/engine.test.ts`, `tests/scenarios.test.ts` | **Đạt** |
| Hồi quy Phase 1–2 không bị thay thế + Determinism SHA-256 cả 3 Đêm | Chạy `npm run verify` gồm `tests/phase2-features.test.ts` (8/8 PASS) và `scripts/verify-phase3.mjs` | `N1=9e921a6b39edab81`, `N2=22ca97b974437ee8`, `N3=843474416fae1928`, Full N3 = `415ms` | **Đạt** |
| Review độc lập bởi agent khác người viết | Subagent `Phase 3 Independent Reviewer` phát hiện & đã sửa 4 điểm trước khi chốt | Xem `docs/notes/ai-log.md` | **Đạt** |

---

## Reproducible CLI Proof Artifacts
- [night1-v12-run1.jsonl](night1-v12-run1.jsonl) (`sha256=9e921a6b39edab81...`)
- [night2-v12-run1.jsonl](night2-v12-run1.jsonl) (`sha256=22ca97b974437ee8...`)
- [night3-v12-run1.jsonl](night3-v12-run1.jsonl) (`sha256=843474416fae1928...`)
- [night3-full-18000.jsonl](night3-full-18000.jsonl) (`415ms <= 30,000ms`)
