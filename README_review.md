# Đảo Đèn Lồng — Game 3D & Headless Engine (Contract v1.2)

> **Video Demo (< 5 phút):** *(Sẽ đính kèm link Release `v1.0.0` / `docs/demo/demo.mp4` sau khi quay tại CP5)*
> **Lưu ý file `_review`:** File này được đặt tên `README_review.md` để giữ nguyên tuyệt đối 6 file đề bài gốc (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`) cho tới khi tác giả duyệt chốt nộp.

## Giới thiệu
**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**: người chơi điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom **Đom Đóm**, thắp và **châm dầu giữ đèn sáng tới bình minh** (tối thiểu `60%` tổng số đèn: `3/5`, `4/6`, `5/7`), đẩy lùi **Bóng Mực** (gồm cả cơ chế hút dầu `drain`) và **Gió Lạc**, tận dụng **Lướt (Dash)**, **Bục nhảy**, **Bùa Gió**, **Tỏa Sáng (Pulse)** và hỗ trợ **chế độ mù màu**.

- **Tác giả:** TruongHoangTung — MSSV: `2A202603651` — Lớp: `K5-L3A`
- **Công nghệ:** TypeScript, Vite, Three.js (đồ họa 3D procedural chuẩn bảng màu), Web Audio API (âm thanh tổng hợp), Node.js thuần (core engine & headless CLI), Vitest.
- **Giấy phép:** [MIT](LICENSE) | **Ghi nguồn:** [CREDITS.md](CREDITS.md) | **Thay đổi phá vỡ:** [CHANGELOG.md](CHANGELOG.md)

---

## Cài đặt & Chạy nhanh (tối đa 3 lệnh)
*(Yêu cầu Node.js >= 18; chạy đồng nhất trên Windows, macOS và Linux)*

```bash
npm ci
npm run build
npm run preview
```
Mở trình duyệt tại địa chỉ hiển thị (mặc định `http://localhost:4173`). Để chạy chế độ phát triển nóng: `npm run dev`.

---

## Điều khiển (Game 3D)
| Phím / Thao tác | Hành động |
|---|---|
| `W / A / S / D` hoặc `↑ / ↓` | Di chuyển theo hướng camera (`6.0 m/s`, `7.2 m/s` khi có Bùa Gió) |
| `Space` | Nhảy (`7.0 m/s`, chỉ nhảy khi chạm đất) |
| `Shift` | Lướt / Dash (`14 m/s`, `0.2s`, giữ độ cao trên không, hồi chiêu `1.5s`, không hồi chiêu khi có Bùa Gió) |
| `E` hoặc `Enter` | Nạp đom đóm vào đèn gần nhất (`<= 2.0m`): thắp mới (`10`), thắp lại (`5`) hoặc châm dầu đèn sáng (`+10` dầu/đom đóm) |
| `Q` | Tỏa Sáng / Pulse (tốn `3` đom đóm, bán kính 3D `5m` từ chân `+0.8m`, làm choáng `120` tick & đẩy lùi `4m`, hồi chiêu `3s`) |
| `Esc` hoặc `P` | Tạm dừng / Cài đặt (âm lượng, độ nhạy chuột, **Bảng màu dễ phân biệt / chế độ mù màu**) |
| Kéo chuột trái hoặc `← / →` | Xoay góc nhìn camera (`cam_yaw_deg`) |
| `M` | Bật / tắt âm thanh tổng hợp |

---

## Chạy Kiểm chứng & Chế độ Headless (Test Contract v1.2)
Chạy toàn bộ cổng kiểm chứng (typecheck + build CLI + 27 tests + SHA-256 determinism cho 3 Đêm + benchmark trọn Đêm 3 + build web) bằng **1 lệnh**:

```bash
npm run verify
```

Chạy trực tiếp chế độ headless cho Đêm `1 | 2 | 3` theo [game.contract.json](game.contract.json):

```bash
node dist-cli/cli/headless.js --seed 2026 --night 3 --ticks 18000 --snapshot-every 600 --out out.jsonl
```

---

## Luật chơi & Cách tính điểm (Ticket-03 / Contract v1.2)
- **3 Đêm sinh tồn tới bình minh:**
  - **Đêm 1 — Đảo Bến:** `240s`, cần giữ sáng `>= 3/5` đèn lúc bình minh.
  - **Đêm 2 — Đảo Cau:** `270s`, cần giữ sáng `>= 4/6` đèn lúc bình minh (cầu tre, bục nhảy, Bùa Gió, Gió Lạc).
  - **Đêm 3 — Đảo Chuông:** `300s`, cần giữ sáng `>= 5/7` đèn lúc bình minh (3 tầng, 2 dốc, tháp chuông, gió mạnh).
- **Nhiên liệu đèn & Bóng Mực hút dầu (`drain`):**
  - Đèn vừa thắp có `fuel = 100`, hao đúng `1/60` mỗi tick (số nguyên tránh sai số thực). Châm dầu nạp `min(carried, ceil((100 - fuel)/10))` đom đóm (`+10` dầu/đom đóm); đèn đầy dầu bị bỏ qua khi tương tác.
  - Đèn có `fuel < 30` mất vùng an toàn `6m` (đúng `30` vẫn còn); Bóng Mực `wander` sẽ tiến vào `<= 2m` chuyển `drain` hút `5/60` mỗi tick (cộng dồn nhiều con). Hết dầu (`<= 0`) đèn tắt (`lantern_out`), thắp lại chỉ cần `5` đom đóm.
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)` mỗi Đêm.
- **Điểm số chuẩn hóa (v1.2):**
  - `+5` mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu)
  - `+100` thắp lần đầu · `+40` thắp lại
  - `+5` mỗi Bóng Mực trúng Tỏa Sáng (`+15` tổng nếu ngay trước đó nó đang `drain`)
  - **Thưởng bình minh (chỉ khi thắng `dawn_survived`):** mỗi đèn đang sáng `+(50 + floor(fuel))` + mỗi Ngọn Lửa còn lại `+50` (đã bỏ thưởng thời gian).

---

## Sáng tạo của tôi
Tất cả phần sáng tạo nằm hoàn toàn trong `src/render/` — **tách biệt tuyệt đối khỏi `src/core/` và không làm thay đổi bất kỳ byte nào của đầu ra headless**:
1. **Không khí Ba Hòn Đảo + Khả năng tiếp cận (Accessibility) trực quan:** Mây đội nón lá treo chiếc đèn lồng mini tỏa sáng dần theo tỉ lệ `carried / capacity`; bầu trời sao + biển mây trôi quanh bến gỗ/cầu tre/tháp chuông; thanh dầu 3D + nhấp nháy `1 Hz` khi đèn yếu; đèn tắt xẹp 20% kèm vết rách phân biệt không cần màu; chế độ mù màu chuyển mắt Bóng Mực sang `#00B3FF` và cảnh báo UI `#FFFFFF` kèm `⚠`.
2. **Âm thanh tổng hợp thời gian thực (Web Audio API):** Nhạc nền gió đêm + bộ SFX đầy đủ tổng hợp bằng code (0 file audio ngoài, chỉnh âm lượng lưu qua `localStorage`).
- **Bằng chứng không phá phần lõi:** `src/core/` không có import Three.js/DOM; `npm run verify` chạy 100% Node.js thuần xác nhận 27/27 test xanh và SHA-256 determinism cho cả 3 Đêm — xem `docs/proof/phase-3/verification-report.md`.

---

## Tài liệu & Bằng chứng SDLC
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md)
- ADR Phase 3: [docs/notes/adr-001-lantern-fuel-and-dawn-survival.md](docs/notes/adr-001-lantern-fuel-and-dawn-survival.md)
- Changelog (Breaking Changes): [CHANGELOG.md](CHANGELOG.md)
- Giả định & tiêu chí nghiệm thu: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký AI, phân tích lỗi & token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro dự án: [docs/notes/retro.md](docs/notes/retro.md)
- Bằng chứng từng phase: `docs/proof/phase-1/`, `docs/proof/phase-2/`, `docs/proof/phase-3/`
