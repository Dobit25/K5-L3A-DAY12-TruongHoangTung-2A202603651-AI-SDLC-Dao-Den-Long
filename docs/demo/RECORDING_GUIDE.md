# Kịch bản quay Video Demo `< 5 phút` (CP5)

> Mục tiêu: quay 1 file `demo.mp4` (720p, `< 100 MB`, dài `~3 phút 30 giây`, tối đa 5 phút) bằng **Windows Snipping Tool (Win + Shift + R)** hoặc **OBS Studio**.

## Chuẩn bị trước khi bấm quay (trong conda `gen`)
Mở 2 cửa sổ cạnh nhau (hoặc chuyển đổi nhanh bằng `Alt + Tab`):
1. Terminal PowerShell đang đứng ở `D:\Coding\Project\K5-L3A-LAB-Day12-AI-SDLC` (đã chạy `conda activate gen`).
2. Trình duyệt mở sẵn `http://localhost:4173` (sau khi chạy `npm start`).

---

## Kịch bản từng mốc (~3 phút 30 giây)

### 1. Chơi trực tiếp Game 3D (~1 phút 30 giây)
- **0:00 – 0:20:** Mở Menu chính → giới thiệu nhanh **Bảng xếp hạng**, **Cài đặt & Tiếp cận** (bật thử **Chế độ mù màu** / **Chữ lớn ×1.25** / **Đổi phím**).
- **0:20 – 1:05:** Vào **Đêm 1 — Đảo Bến** (lời Ông Đăng) → chạy `WASD`, nhảy `Space`, lướt `Shift`, nhặt đom đóm, bấm `E` nạp thắp Đèn Lồng Lớn, dùng `Q` (Tỏa Sáng) xua Bóng Mực, bấm `Esc` xem menu tạm dừng.
- **1:05 – 1:30:** Mở nhanh **Đêm 2 — Đảo Cau** (phóng bục nhảy qua cầu tre) hoặc **Đêm 3 — Đảo Chuông** (3 tầng + dốc + tháp chuông).

### 2. Chạy Kiểm chứng tự động, Headless, Soak & Benchmark (~1 phút 20 giây)
Chạy lần lượt 3 lệnh trong terminal:
```powershell
npm run verify
node --expose-gc dist-cli/cli/soak.js --seed 7 --nights 10 --out soak.json; Get-Content soak.json
node scripts/bench.mjs --seed 42 --duration 15 --out tmp-bench.json; Get-Content tmp-bench.json
```
*(Ghi chú: file `bench.json` trong repo đã được đo đủ 30 giây; trong video bạn có thể chạy 15s hoặc mở `Get-Content bench.json` để tiết kiệm thời gian dưới 5 phút).*

### 3. Lướt nhanh Harness AI, Bằng chứng & Lịch sử Git (~40 giây)
Chạy 1 lệnh trong terminal để hiện lịch sử commit, đủ 4 tag và cấu trúc harness:
```powershell
git log --oneline -n 15; git tag --list; ls docs/proof, docs/notes, .agents/skills/verify-phase
```
Mở lướt qua `AGENTS.md`, `CHANGELOG.md`, `docs/notes/adr-001-lantern-fuel-and-dawn-survival.md`, và `docs/notes/retro.md`.

---

## Đính kèm Video vào Release `v1.0.0` (sau khi quay xong)
```powershell
gh release upload v1.0.0 demo.mp4 --clobber
```
*(Hoặc copy file vào `docs/demo/demo.mp4` nếu `< 100 MB` và cập nhật link ở đầu README).*
