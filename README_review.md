# Đảo Đèn Lồng — Game 3D & Headless Engine

> **Video Demo (< 5 phút):** *(Sẽ đính kèm link Release `v1.0.0` / `docs/demo/demo.mp4` sau khi quay tại CP5)*
> **Lưu ý file `_review`:** File này được đặt tên `README_review.md` để giữ nguyên tuyệt đối 6 file đề bài gốc (`README.md`, `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`) cho tới khi tác giả duyệt chốt nộp.

## Giới thiệu
**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba: người chơi điều khiển **Mây** (đội nón lá treo chiếc đèn lồng nhỏ) chạy quanh **Đêm 1 — Đảo Bến**, thu thập **Đom Đóm** để thắp sáng **5 Đèn Lồng Lớn**, né **Bóng Mực** trong sương đen và dùng **Tỏa Sáng (Pulse)** để xua đuổi chúng.

- **Tác giả:** TruongHoangTung — MSSV: `2A202603651` — Lớp: `K5-L3A`
- **Công nghệ:** TypeScript, Vite, Three.js (đồ họa 3D procedural), Web Audio API (âm thanh tổng hợp), Node.js thuần (core engine & headless CLI), Vitest.
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
| `W / A / S / D` hoặc `↑ / ↓` | Di chuyển theo hướng camera |
| `Space` | Nhảy |
| `E` hoặc `Enter` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (`<= 2.5m`) |
| `Q` hoặc `Shift` | Tỏa Sáng / Pulse (tốn `2` đom đóm, đẩy lùi & làm choáng Bóng Mực trong `8m`) |
| Kéo chuột trái hoặc `← / →` | Xoay góc nhìn camera (`cam_yaw_deg`) |
| `M` | Bật / tắt âm thanh tổng hợp |
| `R` (hoặc nút **Chơi lại**) | Chơi lại sau khi thắng hoặc thua |

---

## Chạy Kiểm chứng & Chế độ Headless (Test Contract v1.0)
Chạy toàn bộ cổng kiểm chứng (typecheck + build CLI + unit tests + scenario CLI + kiểm tra tính tất định SHA-256 + build web) bằng **1 lệnh**:

```bash
npm run verify
```

Chạy trực tiếp chế độ headless theo [game.contract.json](game.contract.json):

```bash
node dist-cli/cli/headless.js --seed 2026 --night 1 \
  --scenario tests/fixtures/phase1-win-scenario.json \
  --inputs tests/fixtures/phase1-win-inputs.json \
  --ticks 300 --snapshot-every 20 --out out.jsonl
```

---

## Quy tắc & Giả định Phase 1 (khớp `game.contract.json`)
- **Nhặt đom đóm:** Tự động nhặt khi vào `pickup_radius = 1.8m` (mặt phẳng XZ, `<=`). Tối đa cầm `carry_capacity = 10`; khi đầy, đom đóm còn lại giữ nguyên trên mặt đất (không nhặt, không mất).
- **Nạp đèn:** Kích hoạt bằng `interact` (`false -> true`) trong `interact_radius = 2.5m`, nạp `min(carried, 5 - deposited)` vào đèn chưa sáng gần nhất và giữ lại phần dư. Đủ `5` sẽ thắp đèn (`lantern_lit`).
- **Tỏa Sáng (Pulse):** Trừ `pulse_cost = 2` từ `carried`, hồi chiêu `2.0s`. Thiếu đom đóm hoặc đang hồi chiêu sẽ không kích hoạt và không phát event `pulse`. Khi kích hoạt: làm choáng mọi Bóng Mực trong `8.0m` trong `3.0s` và đẩy lùi `6.0m`.
- **Bị chạm & Rơi khỏi đảo:** Bị Bóng Mực không choáng chạm trong `1.4m` sẽ mất `1` ngọn lửa (tối đa `3`), rơi `Math.floor(carried * 0.5)` đom đóm (tan biến, không tạo lại mote trên đất), nhận miễn thương `1.5s`. `fall_enabled = false` nên không phạt rơi khỏi đảo và không phát `player_hit` loại `fall`.
- **Vùng an toàn quanh đèn (`safe_radius = 6.0m`):** Áp dụng cho đèn đã thắp (`lit: true`). Bóng Mực đang trong vùng khi đèn vừa sáng bị đẩy ngay ra ngoài `6.05m` và không bao giờ đi vào lại vùng an toàn.
- **Cách tính điểm:**
  - Nhặt 1 đom đóm: `+10` (`per_mote`)
  - Thắp 1 Đèn Lồng Lớn: `+200` (`per_lantern`)
  - Làm choáng 1 Bóng Mực bằng Pulse: `+50` (`per_stun`)
  - **Thưởng khi thắng** (cộng ngay tại tick `game_over` thắng, giúp `end.score` khớp snapshot cuối): `+5` mỗi giây còn lại (`Math.floor(time_left_s) * 5`) + `+100` mỗi ngọn lửa còn lại (`flames * 100`). Khi thua không cộng thưởng.

---

## Sáng tạo của tôi
Tất cả phần sáng tạo dưới đây nằm hoàn toàn trong lớp hiển thị `src/render/` — **tách biệt tuyệt đối khỏi `src/core/` và không làm thay đổi bất kỳ byte nào của đầu ra headless**:
1. **Không khí Đảo Bến nở sáng dần theo tiến độ đèn lồng:** Mây đội nón lá có chiếc đèn lồng mini tỏa sáng mạnh dần theo số đom đóm đang mang; biển mây trôi quanh bến gỗ và bầu trời sao; khi thắp mỗi Đèn Lồng Lớn, sương đêm (`FogExp2`) lùi dần, ánh sáng môi trường chuyển ấm từ xanh đêm sang vàng cam cổ tích, vòng an toàn `safe_radius` hiện ánh sáng dịu trên mặt đất, và sóng ánh sáng 3D bung ra khi dùng Pulse.
2. **Âm thanh tổng hợp thời gian thực (Web Audio API):** Chuông gió ngũ cung tăng cao độ theo số đom đóm nhặt được, hợp âm ấm khi nạp/thắp đèn, sóng cộng hưởng khi Pulse, âm trầm cảnh báo khi bị chạm (có nút `M` tắt/mở, 0 file audio ngoài).
- **Bằng chứng không phá phần lõi:** `src/core/` không có bất kỳ import nào từ `src/render/` hay `three`; bộ kiểm chứng `npm run verify` chạy 100% qua Node.js thuần và xác nhận đầu ra headless trùng khớp SHA-256 tuyệt đối (xem `docs/proof/phase-1/verification-report.md`).

---

## Tài liệu & Bằng chứng SDLC
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md)
- Giả định & tiêu chí nghiệm thu: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký AI, phân tích lỗi & token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro dự án: [docs/notes/retro.md](docs/notes/retro.md)
- Bằng chứng từng phase: `docs/proof/`
