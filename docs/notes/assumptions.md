# Assumptions, Acceptance Criteria & Design Changes

> Ghi lại yêu cầu bắt buộc, giả định cho chỗ mơ hồ, tiêu chí nghiệm thu kiểm chứng được, và lý do thay đổi thiết kế qua từng phase.

---

## CP0 — Preparation
- **Tech stack:** TypeScript + Vite + Three.js (3D browser) + Node.js thuần (core simulation & headless CLI) + Vitest.
- **Cross-platform guarantee:** Toàn bộ `src/core/` và `src/cli/` chạy thuần trên Node.js (Windows, macOS, Linux) không phụ thuộc DOM/WebGL; bản 3D chạy qua Vite / static web server chuẩn.
- **Original files policy:** Giữ nguyên tuyệt đối 6 file đề bài gốc; sản phẩm dùng `README_review.md` để người dùng duyệt trước khi chốt nộp.

---

## Phase 1 (PRD-0 + Test Contract v1.0)

### A. Yêu cầu bắt buộc (Hard Contract)
1. **Đêm 1 — Đảo Bến:** hòn đảo tròn mặt đất `Y = 0`, người chơi xuất phát `(0, 0, 0)`, 5 Đèn Lồng Lớn (`L1`..`L5`).
2. **`game.contract.json`** ở gốc repo với `contract_version: "1.0"`, `team: "2A202603651-TruongHoangTung"`, lệnh `build_cmd`, `run_cmd`, `headless_cmd`, và bảng `tuning` khớp 100% logic game.
3. **Chế độ headless 60 tick/giây:** hỗ trợ `--seed`, `--night 1`, `--scenario`, `--inputs`, `--ticks`, `--out`, `--snapshot-every` (mặc định 10). Thoát `0` khi thành công, `2` khi file scenario/inputs sai định dạng, khác `0` khi lỗi CLI.
4. **Mô hình tick & đầu ra JSONL:**
   - Snapshot tick `0` sau khi dựng scenario (không phát event, không cộng điểm khi dựng scenario).
   - Bước `k` đọc input tick `k` → sinh trạng thái `k+1`, event mang `tick = k+1` và luôn đứng trước snapshot cùng tick.
   - `time_left_s = initial_duration_s - stepsRun / 60`.
   - Dòng `end` luôn là dòng cuối cùng; tọa độ làm tròn 3 chữ số thập phân; tất định 100% với cùng `seed + scenario + inputs`.
5. **Di chuyển theo camera:** chuẩn hóa vector `move` nếu độ dài > 1; xoay theo `cam_yaw_deg` với `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ`.
6. **Khoảng cách đo theo mặt phẳng XZ (`<= r`)** giữa các điểm quy ước.

### B. Giả định cho các phần PRD-0 để mở (căn cứ 7 giải đáp CP1)
1. **Nhặt đom đóm:** Tự động nhặt khi đi vào `pickup_radius = 1.8m` (XZ `<= 1.8`). Giới hạn `carry_capacity = 10`; khi đầy, đom đóm giữ nguyên trên mặt đất (không nhặt, không mất). Mỗi lần nhặt phát `mote_picked` với `carried` mới và cộng `per_mote = 10`.
2. **Nạp đèn:** Khi kích hoạt `interact` (chuyển `false -> true`) trong `interact_radius = 2.5m` tới đèn chưa sáng gần nhất (hòa khoảng cách ưu tiên `id` tăng dần), nạp `amount = min(carried, lantern_cost - deposited)` (`lantern_cost = 5`) và giữ lại phần dư trên tay Mây. Khi `deposited === 5`, đèn sáng (`lit = true`), cộng `per_lantern = 200`, phát `lantern_lit`.
3. **Tỏa Sáng (Pulse):** Tiêu tốn `pulse_cost = 2` đom đóm đang cầm, cooldown `pulse_cooldown_s = 2.0s`. Không đủ đom đóm hoặc đang hồi chiêu thì không kích hoạt và không phát event `pulse`. Khi kích hoạt: làm choáng mọi Bóng Mực trong `pulse_radius = 8.0m` trong `pulse_stun_s = 3.0s`, đẩy lùi `pulse_push_m = 6.0m`, cộng `per_stun = 50` mỗi con, phát `pulse` kèm `stunned_ids`.
4. **Bị Bóng Mực chạm:** Khi `invuln_s <= 0` và Bóng Mực không ở trạng thái `stunned` vào `shade_hit_radius = 1.4m`: mất 1 `flame`, rơi `dropped = Math.floor(carried * hit_drop_ratio)` (`hit_drop_ratio = 0.5`), `carried -= dropped`, nhận `invuln_s = 1.5s`. Đom đóm rơi tan biến (không sinh lại mote trên đất) nên `motes_active` nhất quán.
5. **Rơi khỏi đảo:** `fall_enabled = false` — giữ Mây trong rìa đảo (tự mở rộng biên nếu scenario đặt thực thể xa hơn bán kính mặc định 42m), nên không phát event `player_hit` loại `"fall"`.
6. **Vùng an toàn quanh đèn (`safe_radius = 6.0m`):** Áp dụng cho **đèn đã thắp (`lit: true`)**. Khi đèn vừa được thắp hoặc sau mỗi bước di chuyển/đẩy lùi, mọi Bóng Mực nằm trong vùng đều bị đẩy ra ngay ngoài `safe_radius + 0.05m` nên không bao giờ nằm trong vùng an toàn.
7. **Điểm thưởng thắng:** Cộng ngay tại tick phát `game_over` (`won`, `all_lit`): `Math.floor(time_left_s) * per_second_left + flames * per_flame_left` (`per_second_left = 5`, `per_flame_left = 100`), bảo đảm `end.score` khớp snapshot cuối. Khi thua (`no_flames` hoặc `dawn`) không cộng thưởng.

### C. Tiêu chí nghiệm thu kiểm chứng được (Acceptance Criteria)
- **AC-1.1:** `game.contract.json` khớp 100% `DEFAULT_TUNING` (kiểm chứng bởi `tests/contract.test.ts`).
- **AC-1.2:** Di chuyển theo `cam_yaw_deg` (0° và 90°) và chuẩn hóa đường chéo `[1, 1]` đúng công thức Contract C (`tests/engine.test.ts`).
- **AC-1.3:** Nhặt đom đóm tự động trong `1.8m`, không vượt `carry_capacity = 10`, không làm mất đom đóm dư (`tests/engine.test.ts`).
- **AC-1.4:** Nạp đèn chuyển đúng `min(carried, needed)`, giữ phần dư, thắp đèn ở 5/5, thắng & cộng thưởng khớp `end.score` (`tests/engine.test.ts`).
- **AC-1.5:** Pulse không phát event khi thiếu đom đóm; khi đủ sẽ trừ `2`, đẩy lùi `6m`, stun `3s`, phát `pulse` (`tests/engine.test.ts`).
- **AC-1.6:** Bóng Mực không vào `safe_radius = 6.0m` quanh đèn đã thắp, kể cả khi bị đẩy khi đèn vừa sáng (`tests/engine.test.ts`).
- **AC-1.7:** Bị chạm rơi `floor(carried * 0.5)`, miễn thương `1.5s`, thua `no_flames` khi `flames = 0` và thua `dawn` khi hết giờ (`tests/engine.test.ts`).
- **AC-1.8:** CLI headless xuất đúng thứ tự JSONL (tick 0 → events trước snapshot cùng tick → `end` cuối cùng), mã thoát `0/1/2` chính xác, và chạy 2 lần cùng seed cho kết quả **trùng khớp từng byte (SHA-256)** (`tests/scenarios.test.ts` + `scripts/verify-phase1.mjs`).
- **AC-1.9:** Bản 3D build thành công (`dist/`) với đủ nhân vật Mây đội nón lá + đèn lồng mini, 5 Đèn Lồng Lớn, Đom Đóm, Bóng Mực, HUD, nút chơi lại và hiệu ứng sáng tạo không ảnh hưởng headless.

---

## Phase 2 (Ticket-02 — "Ba hòn đảo" — Contract v1.1)

### A. Thay đổi từ Phase 1 → Phase 2 (chuẩn hóa số liệu)
- `lantern_cost`: `5 -> 10`; `pickup_radius`: `1.8 -> 1.0` (thêm `|dy| <= 1.5`); `interact_radius`: `2.5 -> 2.0`.
- `pulse`: `cost 2 -> 3`, `radius 8 -> 5` (3D từ chân Mây `+0.8m`), `stun 180 -> 120` tick, `push 6m -> 4m` trong 15 tick đầu, `cooldown 120 -> 180` tick.
- `shade`: tốc độ `3.5 -> 4.0 m/s` (Đêm 3: `4.5`), `hit_radius 1.4 -> 1.0` (`|dy| <= 1.5`), recoil `2m / 60` tick, phát hiện `12m` / bỏ đuổi `18m`, sinh theo lịch (2 con @ tick 300 rồi mỗi 480/420/360 tick, tối đa 6/8/10), tên trạng thái chuẩn `spawning | wander | chase | recoil | stunned`.
- `fall_enabled`: `false -> true` (`Y < -10`, bỏ qua bất tử, mất toàn bộ đom đóm, chờ 60 tick hồi sinh với 90 tick bất tử).
- **Tính điểm chuẩn hóa:** `+10` mỗi đom đóm **nạp** (thay vì lúc nhặt ở Phase 1), `+100` đèn thắp, `+5` mỗi Bóng Mực trúng Pulse (kể cả đang choáng), thưởng thắng `floor(time_left_s) * 2 + 50 * flames`.
- **Cập nhật test Phase 1 có ghi lý do:** `tests/engine.test.ts`, `tests/contract.test.ts`, `tests/scenarios.test.ts` được cập nhật theo số liệu chuẩn v1.1 (ghi rõ lý do ở đầu file `tests/engine.test.ts`).

### B. Acceptance Criteria cho từng mục Phần 3 (Ticket-02 DoD)
- **AC-2.1 (Lướt / Dash):** `14 m/s`, `12` tick, giữ độ cao khi lướt trên không, hồi chiêu `90` tick từ lúc bắt đầu, phát event `dash` (`tests/phase2-features.test.ts`).
- **AC-2.2 (Rơi khỏi đảo):** Khi `Y < -10` kích hoạt 1 lần kể cả đang bất tử, trừ 1 Ngọn Lửa, mất hết đom đóm, phát `player_hit {by:"fall", lost}`, chờ 60 tick hồi sinh tại `(0,0,0)` với 90 tick bất tử (`tests/phase2-features.test.ts`).
- **AC-2.3 (Đêm 2 — Đảo Cau):** 2 đảo R=28 tâm `(0,0)` và `(70,0)`, cầu tre `[26,44]x[-2,2]`, 6 đèn `L1..L6`, 2 bục nhảy `(20,0,18)` & `(50,0,-18)` phóng sang đảo kia trong ~1.4s (`tests/phase2-features.test.ts`).
- **AC-2.4 (Đêm 3 — Đảo Chuông):** 3 tầng `Y=0/3/6`, 2 dốc `30°`/`150°`, bục nhảy `(0,3,13)` lên tầng 2, tháp chuông cản trụ R=2, 7 đèn `L1..L7`, gió mạnh mỗi 30s kéo dài 5s đẩy `2 m/s` (`tests/phase2-features.test.ts`).
- **AC-2.5 (Gió Lạc / Drifter):** Đêm 2 & 3, sinh ở tick 1200/2400 tối đa 2 con; `idle` (2 m/s) → `chase` (7 m/s khi `carried >= 5` & `<= 15m`) → `drifter_steal` tối đa 3 đom đóm (bỏ qua bất tử & vùng an toàn) → `flee` 240 tick; trúng Pulse lúc `flee` thì phát `drifter_drop` rơi đom đóm ra đất (`tests/phase2-features.test.ts`).
- **AC-2.6 (Bùa Gió / Charm):** Đêm 2 `(35,0,0)`, Đêm 3 `(±30,0,25)`; nhặt phát `charm_picked` hiệu lực 600 tick (`7.2 m/s`, Lướt không hồi chiêu), hồi lại sau 2700 tick (`tests/phase2-features.test.ts`).
- **AC-2.7 (Tạm dừng / Pause):** `pause: true` phát `paused`, đứng yên `sim_tick`, thời gian và mọi bộ đếm; snapshot ghi `state: "paused"`; `pause` lại phát `resumed` (`tests/phase2-features.test.ts`).
- **AC-2.8 (Chuỗi 3 Đêm, Cài đặt, Âm thanh, HUD, Bảng màu chuẩn):** Menu chính → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế / Bình Minh; cài đặt âm lượng & độ nhạy chuột lưu `localStorage`; đầy đủ SFX + nhạc nền đêm + đếm ngược 10s cuối; HUD đủ 10 ô đom đóm, hồi chiêu Lướt/Tỏa Sáng, nhắc nạp `E`, mũi tên chỉ đèn ngoài màn hình; bảng màu chuẩn `PALETTE` và ánh sáng môi trường `0.15 + 0.55 * (lit/total)` (`src/render/game3d.ts`, `src/render/audio.ts`).
- **AC-2.9 (Hiệu năng headless):** Chạy trọn Đêm 3 (`21.600` tick) hoàn tất trong `<= 30 giây` (`scripts/verify-phase2.mjs`).

---

## Phase 3 (Ticket-03)
*(Chờ nội dung Ticket-03 từ Lab board)*

---

## Phase 4 (Ticket-04)
*(Chờ nội dung Ticket-04 từ Lab board)*
