# AI Usage Log, Error Analysis & Token Tracking

> Theo dõi quy trình làm việc cùng AI qua các phase: lỗi AI phát hiện được, chỉnh sửa harness để chống lặp lỗi, và ước tính token/chi phí + chiến lược tiết kiệm token.

---

## Tổng quan Token & Chiến lược tiết kiệm
- **Chiến lược tiết kiệm token áp dụng ngay từ CP0:**
  1. Giữ `AGENTS.md` ngắn gọn (~45 dòng) để không phình context ở mọi lượt chạy.
  2. Tách biệt kiến trúc `src/core/` (thuần logic) khỏi `src/render/` (Three.js) giúp đọc/sửa cục bộ, không phải nạp lại toàn bộ dự án.
  3. Viết kế hoạch kiểm chứng và scenario headless trước khi sinh code để giảm vòng lặp sửa lỗi tốn token.
  4. Dùng script `npm run verify` 1 lệnh thay vì nhiều lượt hỏi-đáp thủ công.

| Phase | Công việc chính | Số lượt ước tính | Ước tính Token (In / Out) | Ghi chú tiết kiệm token |
|---|---|---:|---:|---|
| CP0 | Khảo sát repo, dựng harness, tài liệu nền | ~4 | ~18k / ~5k | Đọc song song 6 file đề bài trong 1 lượt |
| Phase 1 | *(Chờ triển khai)* | — | — | — |
| Phase 2 | *(Chờ triển khai)* | — | — | — |
| Phase 3 | *(Chờ triển khai)* | — | — | — |
| Phase 4 | *(Chờ triển khai)* | — | — | — |

---

## Nhật ký đánh giá & Phân tích lỗi AI theo Phase

### CP0
- **Đạt:** Xác định đúng cấu trúc 6 file đề bài, bảo toàn file gốc bằng quy ước `_review`, cấu hình remote repo mới, xác định conda env `gen` và dựng harness ban đầu (`AGENTS.md`, skill `verify-phase`).
- **Sự cố & Xử lý:** Chrome DevTools chưa bật remote debugging nên không tự đọc được Lab board qua browser subagent → báo người dùng cung cấp nguyên văn PRD-0 / Test Contract để đảm bảo tuyệt đối không suy đoán yêu cầu.
