# Đảo Đèn Lồng — Game 3D & Headless Engine

> **Video Demo (< 5 phút):** *(Sẽ đính kèm link Release `v1.0.0` / `docs/demo/demo.mp4` sau khi quay tại CP5)*
> **Lưu ý file `_review`:** File này được đặt tên `README_review.md` để giữ nguyên tuyệt đối `README.md` gốc của đề bài cho tới khi người dùng duyệt chốt tên.

## Giới thiệu
**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba xây dựng bằng **TypeScript + Vite + Three.js** (đồ họa 3D procedural & âm thanh Web Audio API) kết hợp **Node.js core engine** tách rời hoàn toàn khỏi trình duyệt để hỗ trợ **chế độ headless tất định (deterministic)** theo Test Contract.

- **Tác giả:** TruongHoangTung — MSSV: `2A202603651` — Lớp: `K5-L3A`
- **Giấy phép:** [MIT](LICENSE) | **Ghi nguồn:** [CREDITS.md](CREDITS.md)

## Cài đặt & Chạy nhanh (tối đa 3 lệnh)
*(Yêu cầu Node.js >= 18; chạy trên Windows, macOS và Linux)*

```bash
npm ci
npm run build
npm run dev
```

## Chạy Test & Chế độ Headless
```bash
npm run verify
```
*(Chi tiết lệnh chạy chế độ headless theo Test Contract sẽ được cập nhật ngay khi hoàn thiện Phase 1).*

## Điều khiển
*(Cập nhật theo PRD-0 ở Phase 1)*

## Sáng tạo của tôi
*(Cập nhật sau khi hoàn thiện tính năng sáng tạo không ảnh hưởng Test Contract ở Phase 1–4)*

## Tài liệu & Bằng chứng SDLC
- Harness AI: [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md)
- Giả định & tiêu chí nghiệm thu: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký AI, phân tích lỗi & token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Retro dự án: [docs/notes/retro.md](docs/notes/retro.md)
- Bằng chứng kiểm chứng từng phase: `docs/proof/`
