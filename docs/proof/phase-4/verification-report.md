# Phase 4 Verification Proof Report (`v1.0.0` · Contract v1.3)

- **Phase:** Phase 4 (`Ticket-04 — "Bình minh: phát hành v1.0.0"` + Test Contract v1.3)
- **Target Tag & Release:** `phase-4` + GitHub Release `v1.0.0`
- **Machine Specs:**
  - **OS:** Windows 11 (`win32 10.0.26200 x64`)
  - **CPU:** 13th Gen Intel Core i5-13450HX (10 cores)
  - **GPU:** NVIDIA GeForce RTX 4050 Laptop GPU (Direct3D11 / ANGLE WebGL2)
  - **RAM:** 15.8 GB
  - **Runtime:** conda env `gen` (`D:\Coding\Anaconda\envs\gen`), Node.js `v26.13.1`, npm `11.20.0`
- **Result:** **PASS (33/33 tests green, SHA-256 determinism N1–N3 green, `bench.json` & `soak.json` exceed all thresholds)**

---

## Measured Benchmark & Soak Proof (Real Execution Matching `phase-4`)

### 1. 30-Second 1280×720 3D Benchmark (`bench.json`)
- **Command:** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`
- **Captured Screenshot:** [screenshot-night1.png](screenshot-night1.png)

| Metric | Measured Value | Target Threshold | Status |
|---|---:|---:|---|
| `avg_fps` | **3,275.7** | `>= 60` | **PASS** |
| `p1_low_fps` | **1,077.9** | `>= 30` | **PASS** |
| `frame_ms_p95` | **0.5 ms** | — | **PASS** |
| `frames` (30s) | **98,272** | — | **PASS** |
| `load_ms` | **1,219 ms** | `<= 10,000 ms` | **PASS** |
| `vsync_off` | `true` | — | **PASS** |
| `peak_mem_mb` | `9.7 MB` (JS heap) | — | **PASS** |

### 2. 10-Night Consecutive Headless Soak Test (`soak.json`)
- **Command:** `node --expose-gc dist-cli/cli/soak.js --seed 7 --nights 10 --out soak.json`

| Metric | Measured Value | Target Threshold | Status |
|---|---:|---:|---|
| `nights` | **10** (Night 1→2→3 cycle) | `10` | **PASS** |
| `crashes` | **0** | `0` | **PASS** |
| `mem_start_mb` | **54.0 MB** | — | **PASS** |
| `mem_end_mb` | **57.4 MB** (`1.063×`) | `<= 1.2×` (`<= 64.8 MB`) | **PASS** |
| `duration_s` | **0.5 s** | — | **PASS** |

---

## Requirement Traceability Matrix (Ticket-04)

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.3 đầy đủ `bench_cmd`, `soak_cmd`, `run_cmd`, `headless_cmd` | Deep-equality test `tests/contract.test.ts` | `tests/contract.test.ts` (4/4 PASS) | **Đạt** |
| Chế độ Benchmark chuẩn 1280×720 (200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng, camera quỹ đạo R=30 Y=15 15s/vòng, 3s warmup + 30s đo) | Chạy thật `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` + kiểm tra ảnh chụp | `bench.json`, `docs/proof/phase-4/screenshot-night1.png` | **Đạt** |
| Soak test 10 Đêm liên tiếp (`crashes = 0`, `mem_end_mb <= 1.2 * mem_start_mb`) | Chạy thật CLI `soak.js` + test tự động `tests/phase4-release.test.ts` | `soak.json` (`0` crash, `54.0 → 57.4 MB`, `1.063×`) | **Đạt** |
| Bảng xếp hạng cục bộ Top 10 (lưu đĩa `data/leaderboard.json`, tên 3–12 ký tự + tiếng Việt NFC, ISO-8601 + TZ, `--export-leaderboard out.json`) | Unit test + CLI e2e `run-game.mjs --export-leaderboard` + kiểm tra UI Menu/End | `tests/phase4-release.test.ts`, `src/core/leaderboard.ts`, `scripts/run-game.mjs` | **Đạt** |
| Dễ tiếp cận: đổi 9 phím chống trùng + mặc định; phụ đề + mũi tên `➤` Bóng Mực / gió / 10s cuối / đèn `<30%`; giảm chuyển động; cỡ chữ `>= 18px` + `×1.25` | Kiểm toán độc lập + build web `vite build` | `src/render/game3d.ts`, `dist/` built cleanly (`2.33s`) | **Đạt** |
| Hồi quy toàn bộ Phase 1–3 + Determinism SHA-256 3 Đêm | `npm run verify` (`33/33` tests PASS) | `N1=9e921a6b39edab81`, `N2=22ca97b974437ee8`, `N3=843474416fae1928` | **Đạt** |
| Đóng gói, Docker, Changelog 4 phase, Credits, License, Retro | Kiểm tra file & review độc lập (đã thêm `.dockerignore` và `HOST=0.0.0.0`) | `Dockerfile`, `.dockerignore`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE`, `docs/notes/retro.md`, `README_review.md` | **Đạt** |
| Video demo `.mp4` `< 5 phút` | Người dùng tự quay theo kịch bản chuẩn bị sẵn tại `docs/demo/RECORDING_GUIDE.md` | *(Chờ người dùng quay & đính kèm Release `v1.0.0`)* | **Chờ người dùng quay** |
