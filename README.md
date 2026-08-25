# Việt Hóa Phụ Đề Video — Full Stack

Hai phần: `backend/` (Express + SQLite + AI + FFmpeg, xem `backend/README.md`) và
`frontend/` (Next.js 15 + TypeScript + Tailwind).

## Đã test thật trong sandbox (không chỉ code sạch/type-check)

- Toàn bộ pipeline HTTP: tạo project → upload video (ffprobe thật) → sinh subtitle
  từ transcript → sửa subtitle qua UI → glossary → QA → export SRT/VTT/ASS → render
  burn-in bằng FFmpeg thật (đã trích frame xác nhận phụ đề tiếng Việt cháy đúng vào hình).
- Frontend chạy thật (`next start`), chụp ảnh bằng Playwright, xác nhận: sửa phụ đề
  trên UI → lưu đúng vào SQLite qua PUT; thêm glossary → lưu và hiển thị ngay; nút
  Undo bật/tắt đúng theo lịch sử chỉnh sửa; timeline đổi màu đúng theo trạng thái QA thật.
- Đã tìm và sửa 2 bug thật trong lúc build:
  1. Thuật toán phân đoạn subtitle dùng CPS làm điều kiện chia — về toán học không
     hội tụ, chẻ câu tới từng ký tự. Đã sửa (xem `backend/README.md`).
  2. Thiếu CORS khiến frontend không gọi được backend từ trình duyệt — đã thêm
     middleware CORS vào Express.

## Chạy thử

```bash
# Terminal 1
cd backend
npm install
cp .env.example .env   # điền VILAO_API_KEY nếu muốn dùng /api/translate, /api/proofread
npm run build
npm start               # http://localhost:4000

# Terminal 2
cd frontend
npm install
cp .env.local.example .env.local
npm run build
npm start                # http://localhost:3000
```

Mở `http://localhost:3000`, tạo project, upload video (mp4/mkv/avi/mov/webm),
rồi dùng `POST /api/subtitle/generate` (xem `backend/README.md`) để nạp transcript
vì chưa có engine STT thật gắn sẵn.

## Chưa làm / giới hạn đã biết

- STT chưa có engine thật — `NotConfiguredSttProvider` throw lỗi rõ ràng thay vì
  giả kết quả (đúng yêu cầu "không fake" của spec gốc).
- Chưa test `/api/translate` và `/api/proofread` với `VILAO_API_KEY` thật — sandbox
  build không có quyền egress ra `api.vilao.ai`. Toàn bộ phần còn lại đã test thật.
- Chưa có WebSocket/SSE cho tiến trình realtime — hiện dùng polling
  `GET /api/project/:id/progress`.
- ASS style editor trên UI mới có chọn preset (5 preset: Default/Movie/Anime/Drama/
  Gaming), chưa có form tùy chỉnh từng thuộc tính (font/size/outline/vị trí) như
  mục 18 mô tả đầy đủ.
