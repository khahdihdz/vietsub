# 🇻🇳 AI Vietsub & Dubbing

Tiện ích mở rộng **Chrome/Brave Manifest V3** giúp tạo phụ đề tiếng Việt theo ngữ cảnh và thuyết minh bằng giọng đọc của trình duyệt, sử dụng **OpenRouter API**.

## ✨ Tính năng

- 📄 Nhập phụ đề **SRT / VTT**.
- 🤖 Dịch bằng OpenRouter, ưu tiên bản dịch tự nhiên thay vì dịch từng chữ.
- 🎭 Giữ ngữ cảnh, tính cách nhân vật, quan hệ xưng hô, cảm xúc, tên riêng và thuật ngữ.
- 📝 Hiển thị phụ đề tiếng Việt trực tiếp trên video HTML5.
- 🎨 Sử dụng Shadow DOM để hạn chế xung đột với giao diện website.
- 🔊 Thuyết minh tiếng Việt bằng **Browser SpeechSynthesis**.
- ⏯️ Đồng bộ phụ đề và thuyết minh theo thời gian phát video.
- 💾 Lưu API key, model, nhiệt độ và prompt cục bộ bằng `chrome.storage.local`.
- 📥 Tự động xuất file `vietsub-vi.srt` sau khi dịch.
- ⚙️ Có trang cài đặt riêng cho OpenRouter.
- 🚀 GitHub Actions tự động kiểm tra và đóng gói extension sau mỗi commit.

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
├── subtitle.js
├── subtitle.css
└── README.md
```

Extension nằm **trực tiếp ở thư mục root**. Không cần vào thư mục `extension/`.

## 🔧 Cài đặt trên Chrome / Brave

### Bước 1 — Tải repository

Clone repository:

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

Chọn:

**Load unpacked / Tải tiện ích đã giải nén**

Sau đó chọn **thư mục repository `vietsub`** — nơi có file `manifest.json`.

## 🔑 Cấu hình OpenRouter

1. Bấm biểu tượng **AI Vietsub** trên thanh công cụ.
2. Chọn **⚙ Cài đặt OpenRouter**.
3. Nhập OpenRouter API Key.
4. Chọn model.
5. Điều chỉnh Temperature nếu cần.
6. Bấm **Lưu**.

API key được lưu trong bộ nhớ cục bộ của extension và **không được commit vào repository**.

## 🎬 Cách sử dụng

### 1. Mở trang có video

Extension hoạt động với video HTML5 trên trang web.

### 2. Nạp phụ đề

Trong popup:

1. Chọn file `.srt` hoặc `.vtt`.
2. Extension sẽ phân tích các câu phụ đề.
3. Phụ đề được gửi tới tab hiện tại.

### 3. Dịch sang tiếng Việt

Bấm:

**Dịch phụ đề sang tiếng Việt**

Extension gửi dữ liệu phụ đề tới OpenRouter và nhận kết quả dịch.

Sau khi hoàn thành:

- Phụ đề tiếng Việt được hiển thị trên video.
- File `vietsub-vi.srt` được tự động tải xuống.

### 4. Bật / tắt phụ đề

Nút:

**Phụ đề: BẬT / TẮT**

### 5. Bật thuyết minh

Nút:

**Thuyết minh: BẬT / TẮT**

Extension sử dụng giọng đọc tiếng Việt có sẵn thông qua `SpeechSynthesis` của trình duyệt.

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

Có thể thay đổi prompt trong phần **Cài đặt OpenRouter**.

## 🔊 Giới hạn của chức năng thuyết minh

Phiên bản hiện tại sử dụng **Browser SpeechSynthesis**.

Điều này có nghĩa:

- Chưa phải hệ thống voice-over studio hoàn chỉnh.
- Chưa tách riêng thoại, nhạc nền và hiệu ứng âm thanh.
- Chưa có audio ducking chuyên nghiệp.
- Chất lượng giọng phụ thuộc vào voice engine của Chrome/Brave và hệ điều hành.
- Khi chuyển/seek video, giọng đang đọc có thể bị hủy để đồng bộ lại.

Đây là nền tảng hiện tại; Web Audio mixer và audio scheduling có thể được bổ sung ở các phiên bản sau.

## 🧪 Kiểm thử

GitHub Actions tự động chạy khi có commit thay đổi extension.

Quy trình hiện tại kiểm tra:

1. Repository được checkout.
2. Đọc và kiểm tra `manifest.json`.
3. Xác nhận Manifest V3.
4. Đóng gói toàn bộ extension thành ZIP.
5. Upload artifact.
6. Cập nhật release `extension-latest`.

Workflow gần nhất đã chạy **thành công** sau commit di chuyển extension ra root repository.

## 📦 Build thủ công

Có thể kiểm tra manifest bằng:

```bash
python3 -c "import json; m=json.load(open('manifest.json')); assert m['manifest_version']==3; print(m['name'], m['version'])"
```

Đóng gói:

```bash
zip -r ai-vietsub-extension.zip . \
  -x ".git/*" ".github/*" "*.zip"
```

Sau đó load file ZIP/giải nén vào Chrome hoặc Brave.

## 🔄 Cập nhật

Mỗi commit thay đổi mã extension sẽ kích hoạt GitHub Actions để tạo bản ZIP mới.

Với **Load unpacked**, trình duyệt không tự động cập nhật extension. Sau khi pull commit mới, vào trang extension và bấm **Reload**.

Cơ chế cập nhật hoàn toàn tự động cho người dùng cuối cần phân phối thông qua Chrome Web Store, Brave Web Store hoặc cơ chế enterprise/policy phù hợp.

## 🔐 Bảo mật

**Không commit API key vào Git.**

API key chỉ nên được nhập trong trang cài đặt extension.

Nếu API key từng bị commit lên repository, hãy thu hồi key đó và tạo key mới.

## 🛠️ Công nghệ

- Chrome Extension Manifest V3
- JavaScript ES Modules
- Chrome Extension APIs
- OpenRouter API
- Shadow DOM
- HTML5 Video API
- Web Speech API / SpeechSynthesis
- GitHub Actions

## 🚧 Định hướng phát triển

Các phần có thể tiếp tục nâng cấp:

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
- Offscreen audio pipeline.
- Test tự động và lint/typecheck.

## 📄 Giấy phép

Repository hiện chưa khai báo giấy phép mã nguồn mở riêng. Nếu muốn phát hành công khai, nên bổ sung file `LICENSE` phù hợp.

---

**Repository:** https://github.com/khahdihdz/vietsub
