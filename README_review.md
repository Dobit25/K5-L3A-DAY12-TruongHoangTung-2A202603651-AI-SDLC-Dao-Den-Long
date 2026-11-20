# Đảo Đèn Lồng — Game 3D & Headless Engine (Contract v1.1)

> **Video Demo (< 5 phút):** *(Sẽ đính kèm link Release `v1.0.0` / `docs/demo/demo.mp4` sau khi quay tại CP5)*
> **Lưu ý file `_review`:** File này được đặt tên `README_review.md` để giữ nguyên tuyệt đối 6 file đề bài gốc (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`) cho tới khi tác giả duyệt chốt nộp.

## Giới thiệu
**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**: người chơi điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom **Đom Đóm** để thắp sáng tất cả **Đèn Lồng Lớn**, né **Bóng Mực** và **Gió Lạc**, tận dụng **Lướt (Dash)**, **Bục nhảy**, **Bùa Gió** và **Tỏa Sáng (Pulse)** để đưa bình minh trở lại quần đảo.

- **Tác giả:** TruongHoangTung — MSSV: `2A202603651` — Lớp: `K5-L3A`
- **Công nghệ:** TypeScript, Vite, Three.js (đồ họa 3D procedural chuẩn bảng màu), Web Audio API (âm thanh tổng hợp), Node.js thuần (core engine & headless CLI), Vitest.
- **Giấy phép:** [MIT](LICENSE) | **Ghi nguồn:** [CREDITS.md](CREDITS.md)

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
| `Shift` | Lướt / Dash (`14 m/s`, `0.2s`, giữ độ cao khi lướt trên không, hồi chiêu `1.5s`, không hồi chiêu khi có Bùa Gió) |
| `E` hoặc `Enter` | Nạp đom đóm vào Đèn Lồng Lớn chưa sáng gần nhất (`<= 2.0m`, cần `10` đom đóm/đèn) |
| `Q` | Tỏa Sáng / Pulse (tốn `3` đom đóm, bán kính 3D `5m` từ chân `+0.8m`, làm choáng `120` tick & đẩy lùi `4m`, hồi chiêu `3s`) |
| `Esc` hoặc `P` | Tạm dừng / Mở menu tạm dừng |
| Kéo chuột trái hoặc `← / →` | Xoay góc nhìn camera (`cam_yaw_deg`, chỉnh độ nhạy trong Cài đặt) |
| `M` | Bật / tắt âm thanh tổng hợp |

---

## Chạy Kiểm chứng & Chế độ Headless (Test Contract v1.1)
Chạy toàn bộ cổng kiểm chứng (typecheck + build CLI + 22 tests + SHA-256 determinism cho 3 Đêm + benchmark 21.600 tick + build web) bằng **1 lệnh**:

```bash
npm run verify
```

Chạy trực tiếp chế độ headless cho bất kỳ Đêm `1 | 2 | 3` theo [game.contract.json](game.contract.json):

```bash
node dist-cli/cli/headless.js --seed 2026 --night 3 --ticks 21600 --snapshot-every 600 --out out.jsonl
```

---

## Số liệu chuẩn & Cách tính điểm (Ticket-02 / Contract v1.1)
- **3 Đêm chuẩn hóa:**
  - **Đêm 1 — Đảo Bến** (`300s`, R=40m, 5 đèn `L1..L5`, tối đa 6 Bóng Mực sinh mỗi 8s)
  - **Đêm 2 — Đảo Cau** (`330s`, 2 đảo R=28m + cầu tre + 2 bục nhảy + 6 đèn `L1..L6`, Bùa Gió `C1`, Gió Lạc, tối đa 8 Bóng Mực sinh mỗi 7s)
  - **Đêm 3 — Đảo Chuông** (`360s`, 3 tầng Y=0/3/6 + 2 dốc 30°/150° + bục nhảy lên tầng 2 + tháp chuông R=2 + 7 đèn `L1..L7`, Bùa Gió `C1/C2`, Gió Lạc, Gió mạnh 30s/5s đẩy `2 m/s`, tối đa 10 Bóng Mực `4.5 m/s` sinh mỗi 6s)
- **Điểm số chuẩn hóa:**
  - `+10` mỗi đom đóm nạp vào đèn (`deposit`)
  - `+100` mỗi Đèn Lồng Lớn thắp sáng (`lantern_lit`)
  - `+5` mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần, kể cả đang choáng)
  - **Thưởng thắng Đêm:** `+ floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại`
  - **Tổng điểm chiến dịch:** tổng điểm của các Đêm đã thắng.

---

## Sáng tạo của tôi
Tất cả phần sáng tạo nằm hoàn toàn trong `src/render/` — **tách biệt tuyệt đối khỏi `src/core/` và không làm thay đổi bất kỳ byte nào của đầu ra headless**:
1. **Không khí Ba Hòn Đảo sống động chuẩn bảng màu cổ tích:** Mây đội nón lá treo chiếc đèn lồng mini tỏa sáng dần theo số đom đóm đang cầm; bầu trời sao + biển mây trôi quanh bến gỗ/cầu tre/tháp chuông; vòng an toàn `safe_radius` 6m hiện dịu quanh đèn đã thắp; lá bay báo hiệu gió mạnh ở Đêm 3; sóng ánh sáng 3D bung ra khi Tỏa Sáng; ánh sáng môi trường tăng tuyến tính đúng công thức `0.15 + 0.55 × (lit / total)`.
2. **Âm thanh tổng hợp thời gian thực (Web Audio API):** Nhạc nền gió đêm êm dịu + hiệu ứng riêng cho nhặt đom đóm (ngũ cung), nhảy, lướt, Bùa Gió, nạp đèn, thắp đèn, Tỏa Sáng, bị đánh, Bóng Mực xuất hiện, Gió Lạc, cảnh báo gió mạnh, đếm ngược 10 giây cuối và thắng/thua (0 file audio ngoài, chỉnh âm lượng lưu giữa các phiên).
- **Bằng chứng không phá phần lõi:** `src/core/` không có import Three.js/DOM; `npm run verify` chạy 100% Node.js thuần xác nhận 22/22 test xanh, SHA-256 determinism cho cả 3 Đêm và chạy trọn Đêm 3 (`21.600` tick) chỉ mất `~143ms` (`<= 30.000ms`) — xem `docs/proof/phase-2/verification-report.md`.

---

## Tài liệu & Bằng chứng SDLC
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md)
- Giả định & tiêu chí nghiệm thu: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký AI, phân tích lỗi & token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro dự án: [docs/notes/retro.md](docs/notes/retro.md)
- Bằng chứng từng phase: `docs/proof/phase-1/`, `docs/proof/phase-2/`
