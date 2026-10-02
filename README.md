# 🇻🇳 AI Vietsub & Dubbing

Tiện ích mở rộng **Chrome/Brave Manifest V3** giúp dịch phụ đề tiếng Việt theo ngữ cảnh, **tự động tạo phụ đề từ âm thanh của video/tab** và thuyết minh bằng giọng đọc của trình duyệt, sử dụng **OpenRouter API**.

## ✨ Tính năng

- ✨ **Tạo phụ đề tự động** từ âm thanh của tab bằng OpenRouter Speech-to-Text.
- ⏱️ Nhận timestamp theo từng đoạn lời thoại và hiển thị trực tiếp theo thời gian video.
- 🇻🇳 Có thể tự động dịch lời thoại nhận dạng sang tiếng Việt ngay khi tạo phụ đề.
- 📄 Nhập phụ đề **SRT / VTT**.
- 🤖 Dịch bằng OpenRouter, ưu tiên bản dịch tự nhiên thay vì dịch từng chữ.
- 🎭 Giữ ngữ cảnh, tính cách nhân vật, quan hệ xưng hô, cảm xúc, tên riêng và thuật ngữ.
- 📝 Hiển thị phụ đề tiếng Việt trực tiếp trên video HTML5.
- 🎨 Sử dụng Shadow DOM để hạn chế xung đột với giao diện website.
- 🔊 Thuyết minh tiếng Việt bằng **Browser SpeechSynthesis**.
- ⏯️ Đồng bộ phụ đề và thuyết minh theo thời gian phát video.
- 💾 Lưu API key, model, STT model, nhiệt độ và prompt cục bộ bằng `chrome.storage.local`.
- 📥 Xuất file `vietsub-vi.srt` sau khi dịch phụ đề có sẵn.
- ⚙️ Có trang cài đặt riêng cho OpenRouter.
- 🚀 GitHub Actions tự động kiểm tra và đóng gói extension sau mỗi commit.

## 🎙️ Tạo phụ đề tự động

Tính năng mới sử dụng **Chrome `tabCapture` + Offscreen Document** để lấy âm thanh của tab hiện tại, sau đó gửi các đoạn audio ngắn tới endpoint Speech-to-Text của OpenRouter.

OpenRouter hỗ trợ endpoint `/api/v1/audio/transcriptions`, các model Whisper và `verbose_json` với timestamp theo segment; extension tự ghép timestamp thành cue phụ đề. cite không đặt trong README

### Cách dùng

1. Mở video có âm thanh.
2. Cấu hình **OpenRouter API Key**.
3. Bấm biểu tượng **AI Vietsub**.
4. Bấm **✨ Tạo phụ đề tự động**.
5. Cho phép extension bắt âm thanh nếu trình duyệt yêu cầu.
6. Extension sẽ liên tục:
   - lấy audio của tab;
   - chia thành các đoạn ngắn;
   - nhận dạng lời thoại;
   - lấy timestamp;
   - dịch sang tiếng Việt nếu bật tùy chọn;
   - đưa cue mới lên video.
7. Bấm **⏹ Dừng tạo phụ đề** để kết thúc.

### Lưu ý

- Chức năng này phải được người dùng kích hoạt bằng nút trong popup; `tabCapture` không được tự ý bắt audio nền. 
- Audio được gửi tới OpenRouter để nhận dạng, vì vậy tính năng STT phát sinh chi phí theo model/API key.
- Tính năng hiện phù hợp nhất với video phát liên tục. Khi seek, tua nhanh hoặc pause nhiều lần, timestamp của các đoạn đang xử lý có thể cần đồng bộ lại.
- OpenRouter có giới hạn xử lý và kích thước request; extension dùng chunk ngắn để phù hợp với pipeline realtime.
- Đây là **phụ đề được nhận dạng từ âm thanh**, không phải lấy trực tiếp subtitle có sẵn của website.

## 📁 Cấu trúc

```text
vietsub/
├── .github/
│   └── workflows/
│       └── extension.yml
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── offscreen.html
├── offscreen.js
├── subtitle.js
├── subtitle.css
└── README.md
```

Extension nằm **trực tiếp ở thư mục root**. Không cần vào thư mục `extension/`.

## 🔧 Cài đặt trên Chrome / Brave

### Bước 1 — Tải repository

```bash
git clone https://github.com/khahdihdz/vietsub.git
cd vietsub
```

Hoặc tải ZIP repository và giải nén.

### Bước 2 — Mở trang quản lý extension

**Chrome:**
```text
chrome://extensions
```

**Brave:**
```text
brave://extensions
```

Bật **Developer mode / Chế độ nhà phát triển**.

### Bước 3 — Load extension

Chọn **Load unpacked / Tải tiện ích đã giải nén**, sau đó chọn **thư mục repository `vietsub`** — nơi có `manifest.json`.

## 🔑 Cấu hình OpenRouter

1. Bấm biểu tượng **AI Vietsub**.
2. Chọn **⚙ Cài đặt OpenRouter**.
3. Nhập OpenRouter API Key.
4. Chọn **Model dịch**.
5. Chọn **Model nhận dạng giọng nói (STT)**, mặc định `openai/whisper-large-v3-turbo`.
6. Bật/tắt **Tự động dịch lời thoại nhận dạng sang tiếng Việt**.
7. Điều chỉnh Temperature nếu cần.
8. Bấm **Lưu**.

API key được lưu cục bộ và **không được commit vào repository**.

## 🎬 Cách sử dụng phụ đề SRT/VTT

1. Mở trang có video.
2. Chọn file `.srt` hoặc `.vtt`.
3. Bấm **Dịch phụ đề sang tiếng Việt**.
4. Phụ đề tiếng Việt được hiển thị và file `vietsub-vi.srt` được tải xuống.

## 🧠 Dịch theo ngữ cảnh

Prompt mặc định yêu cầu AI chú ý tới:

- Ngữ cảnh hội thoại.
- Tính cách nhân vật.
- Quan hệ giữa các nhân vật.
- Đại từ xưng hô.
- Cảm xúc.
- Hài hước.
- Mức độ tục/chửi.
- Tên riêng.
- Thuật ngữ.
- Placeholder.
- Độ dài phù hợp với phụ đề.

Có thể thay đổi prompt trong **Cài đặt OpenRouter**.

## 🔊 Thuyết minh

Extension sử dụng **Browser SpeechSynthesis**:

- Không phải voice-over studio hoàn chỉnh.
- Chưa tách riêng thoại, nhạc nền và hiệu ứng âm thanh.
- Chất lượng giọng phụ thuộc vào Chrome/Brave và hệ điều hành.
- Khi seek video, giọng đang đọc có thể bị hủy để đồng bộ lại.

## 🧪 Kiểm thử

GitHub Actions tự động chạy khi có commit thay đổi extension:

1. Checkout repository.
2. Kiểm tra `manifest.json`.
3. Xác nhận Manifest V3.
4. Đóng gói extension thành ZIP.
5. Upload artifact.
6. Cập nhật release `extension-latest`.

Nên kiểm thử tính năng **Tạo phụ đề tự động** trực tiếp trên Chrome/Brave vì pipeline capture audio và Speech-to-Text phụ thuộc môi trường trình duyệt thực tế.

## 📦 Build thủ công

```bash
python3 -c "import json; m=json.load(open('manifest.json')); assert m['manifest_version']==3; print(m['name'], m['version'])"
zip -r ai-vietsub-extension.zip . -x ".git/*" ".github/*" "*.zip"
```

## 🔄 Cập nhật

Mỗi commit thay đổi mã extension sẽ kích hoạt GitHub Actions để tạo bản ZIP mới.

Với **Load unpacked**, trình duyệt không tự động cập nhật extension. Sau khi pull commit mới, vào trang extension và bấm **Reload**.

Cơ chế cập nhật hoàn toàn tự động cho người dùng cuối cần phân phối thông qua Chrome Web Store, Brave Web Store hoặc cơ chế enterprise/policy phù hợp.

## 🔐 Bảo mật

**Không commit API key vào Git.**

API key chỉ nên được nhập trong trang cài đặt extension. Audio của video được gửi tới OpenRouter khi người dùng chủ động bật chức năng tạo phụ đề tự động.

## 🛠️ Công nghệ

- Chrome Extension Manifest V3
- JavaScript ES Modules
- Chrome `tabCapture`
- Chrome `offscreen`
- OpenRouter Chat Completions
- OpenRouter Speech-to-Text
- Shadow DOM
- HTML5 Video API
- Web Speech API / SpeechSynthesis
- GitHub Actions

## 🚧 Định hướng phát triển

- Theo dõi seek/pause để hiệu chỉnh timestamp realtime.
- Dịch theo batch với previous/current/next context.
- Bộ nhớ nhân vật và glossary.
- Bảo vệ placeholder trước khi dịch.
- Retry khi gặp HTTP 429/5xx.
- Cache bản dịch bằng IndexedDB.
- Parser VTT/ASS/SSA đầy đủ hơn.
- Tự phát hiện subtitle track trên website.
- Lập lịch TTS chính xác theo thời gian cue.
- Web Audio mixer.
- Giảm âm lượng audio gốc khi thuyết minh.
- Hỗ trợ YouTube/Vimeo/Twitch tốt hơn.
- Test tự động và lint/typecheck.

## 📄 Giấy phép

Repository hiện chưa khai báo giấy phép mã nguồn mở riêng.

---

**Repository:** https://github.com/khahdihdz/vietsub
