# Backend — Việt Hóa Phụ Đề Video

## Phase 1 (đã có): Lõi dịch AI
- `AIProvider` abstraction + `VilaoProvider` — gọi thật `POST {VILAO_BASE_URL}/chat/completions` với `model: deepseek/deepseek-v4-pro`, retry + exponential backoff.
- `TranslationService` — chunk cho video dài (có overlap), context trước/sau, glossary + nhân vật, validate JSON bằng Zod, tự repair JSON lỗi, cache theo hash, `retryFailed`.
- `ProofreadService` — pass 2 AI rà lỗi nghĩa/xưng hô/thuật ngữ.
- `QAService` — rule-based: overlap, timestamp lỗi, CPS, thời lượng, dòng quá dài, nhất quán thuật ngữ/xưng hô.
- `GlossaryService`, `CharacterService` (in-memory, dùng trong ví dụ `examples/runPipeline.ts`).

## Phase 2 (mới thêm): Kiến trúc project đầy đủ + API + hạ tầng

### Đã build và **test thật** trong sandbox (không chỉ type-check)
- **Express API** đầy đủ theo mục 26 của spec (xem bảng route bên dưới).
- **SQLite** (`node:sqlite`, built-in Node 22+) lưu Project/Video/Subtitle/Glossary/Character/Progress — schema ở `src/db/schema.sql`.
- **Upload bảo mật (mục 27)** — đã test: chặn sai extension, chặn file đổi đuôi giả (kiểm magic bytes thật), sanitize filename + chặn path traversal (`../../../etc/evil.mp4` bị chuyển an toàn thành tên ngẫu nhiên trong thư mục project), giới hạn dung lượng.
- **FFprobe thật** — lấy đúng duration/resolution/codec ngay sau upload.
- **Export SRT/VTT/ASS** — đã render và kiểm tra định dạng bằng mắt, đúng chuẩn timestamp từng loại. ASS có 5 preset: Default/Movie/Anime/Drama/Gaming.
- **FFmpeg burn-in render thật** — đã render 1 video test, trích frame ra ảnh và **xác nhận bằng mắt phụ đề tiếng Việt có dấu cháy đúng vào hình**.
- **QAService** — đã test, phát hiện đúng CPS cao, dòng quá dài, thuật ngữ/xưng hô không nhất quán trên dữ liệu thật.

### Bug nghiêm trọng đã tìm và sửa trong quá trình build
`SegmentationService` (mục 5 — phân đoạn subtitle) ban đầu dùng **CPS vượt ngưỡng làm điều kiện đệ quy để chia nhỏ câu**. Về mặt toán học, khi thời gian mỗi mảnh chỉ được ước lượng theo tỉ lệ số ký tự (không có timestamp cấp từ), CPS gần như **bất biến** qua mỗi lần chia — chia đôi văn bản thì thời lượng cũng chia đôi theo, nên tốc độ ký tự/giây trung bình không đổi. Hệ quả: thuật toán không bao giờ hội tụ và đệ quy chẻ câu tới **từng ký tự đơn lẻ** (đã tái hiện lỗi này bằng test cụ thể, xem lịch sử conversation).

**Đã sửa:**
- Bỏ CPS khỏi điều kiện chia — chỉ chia dựa trên độ dài hiển thị (`maxCharsPerLine × maxLinesPerSubtitle`) và ngưỡng tối thiểu mỗi mảnh (`minSegmentChars`), luôn ưu tiên tách tại dấu câu mạnh → dấu phẩy → khoảng trắng.
- CPS cao giờ chỉ được `QAService` cảnh báo để người biên tập tự kiểm tra và chỉnh tay (đúng theo mục 16 của spec).
- Thêm hỗ trợ `TranscriptChunk.words` (word-level timestamp) — khi STT engine cung cấp timestamp cấp từ (vd Whisper `word_timestamps=true`), segmentation sẽ chia chính xác theo thời gian thật của từng từ thay vì ước lượng theo tỉ lệ ký tự, giải quyết triệt để vấn đề CPS tại gốc.

### API Routes

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/project` | Tạo project |
| GET | `/api/project` | List project |
| GET | `/api/project/:id` | Chi tiết project (video + subtitles + glossary + characters + progress) |
| PUT | `/api/project/:id` | Đổi tên / cập nhật settings |
| DELETE | `/api/project/:id` | Xóa project |
| GET | `/api/project/:id/progress` | Poll tiến trình pipeline |
| POST | `/api/upload` | Upload video (multipart, field `video` + `projectId`) |
| POST | `/api/transcribe` | Chạy STT (**501** nếu chưa cắm engine thật — xem bên dưới) |
| POST | `/api/subtitle/generate` | Tạo subtitle từ transcript có sẵn (dùng khi STT chạy ngoài) |
| POST | `/api/translate` | Dịch bằng DeepSeek V4 Pro qua Vilao |
| POST | `/api/proofread` | AI proofread (toàn bộ hoặc theo danh sách id) |
| GET/PUT/DELETE | `/api/subtitle/:id?projectId=` | CRUD subtitle thủ công |
| GET | `/api/qa?projectId=` | Chạy QA rule-based |
| GET/POST/DELETE | `/api/glossary` | CRUD glossary |
| POST | `/api/glossary/import`, GET `/api/glossary/export` | Import/export glossary |
| GET/POST/DELETE | `/api/character` | CRUD nhân vật + xưng hô |
| GET | `/api/export/:id?format=srt\|vtt\|ass&preset=` | Export phụ đề |
| POST | `/api/video/render` | Burn-in phụ đề vào video bằng FFmpeg |

### Giới hạn cần biết

- **STT chưa có engine thật.** `NotConfiguredSttProvider` cố tình `throw` (HTTP 501) thay vì trả transcript giả — đúng yêu cầu "không fake kết quả" (mục 30). Để dùng được `/api/transcribe`, implement `SpeechToTextProvider` với engine thật (whisper.cpp local, Whisper API, hoặc engine STT của Vilao nếu có) và thay `NotConfiguredSttProvider` trong `routes/transcribeRoutes.ts`. Trong lúc chưa có engine, dùng `/api/subtitle/generate` với transcript lấy từ nguồn khác.
- **Chưa test được `/api/translate` và `/api/proofread` với API key thật** — sandbox build không có quyền egress tới `api.vilao.ai`. Toàn bộ phần còn lại (upload, ffprobe, segmentation, export, QA, render FFmpeg) đã test thật với dữ liệu thật trong sandbox.
- Cache dịch (`InMemoryCacheStore`) chỉ sống trong quá trình chạy process — mất khi restart server. Thay bằng cache bền vững (bảng SQLite riêng hoặc Redis) khi cần dùng lâu dài.
- Chưa có WebSocket/SSE — polling `GET /api/project/:id/progress` là cách duy nhất theo dõi tiến trình hiện tại. Callback `onProgress` đã có sẵn trong `TranslationService`/routes để nối vào WebSocket sau.
- Kiểm tra nhất quán xưng hô trong `QAService` là heuristic dựa trên chuỗi con, có thể có false positive — chỉ nên hiển thị như gợi ý kiểm tra thủ công.

## Cài đặt

```bash
npm install
cp .env.example .env
# điền VILAO_API_KEY vào .env
npm run build
npm start
# server chạy tại http://localhost:4000
```

Chạy ví dụ pipeline lõi (không qua HTTP):
```bash
npm run start:example
```

## Cấu trúc

```
src/
  app.ts, server.ts              # Express app + entrypoint
  config/env.ts                  # load & validate env (VILAO_API_KEY chỉ bắt buộc khi thực sự dùng AI)
  types/{subtitle,project}.ts
  db/
    schema.sql, client.ts        # SQLite (node:sqlite)
    projectRepository.ts
    subtitleRepository.ts
    glossaryCharacterRepository.ts
  routes/
    projectRoutes.ts, uploadRoutes.ts, transcribeRoutes.ts,
    translateRoutes.ts, proofreadRoutes.ts, subtitleRoutes.ts,
    exportRoutes.ts, videoRoutes.ts
  services/
    ai/{AIProvider,VilaoProvider}.ts
    stt/SpeechToTextProvider.ts   # abstraction — chưa có engine thật
    translation/{promptTemplates,contextBuilder,jsonSchema,translationService}.ts
    proofread/proofreadService.ts
    qa/qaService.ts
    subtitle/{segmentationService,srtExporter,vttExporter,assExporter}.ts
    video/ffmpegService.ts        # ffprobe + burn-in ASS (đã test thật)
    security/uploadValidation.ts  # đã test thật
    cache/cacheService.ts
    glossary/glossaryService.ts, character/characterService.ts  # dùng trong ví dụ Phase 1
  examples/runPipeline.ts
```

## Bảo mật

- `VILAO_API_KEY` chỉ đọc qua `process.env`, không hard-code, không log, không trả về client.
- Upload: sanitize filename (loại path traversal), kiểm extension + magic bytes, giới hạn dung lượng — tất cả đã test thật với input độc hại.

## Bước tiếp theo đề xuất

- Frontend: upload UI, subtitle editor (mục 14), video player đồng bộ (mục 15), ASS style editor (mục 18).
- WebSocket/SSE thật cho tiến trình realtime.
- Cắm engine STT thật khi bạn có quyền truy cập một engine (whisper.cpp/API).
