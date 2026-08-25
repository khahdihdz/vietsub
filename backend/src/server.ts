import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { getDb } from './db/client.js';

const config = loadConfig();

// Khởi tạo DB (áp dụng schema) trước khi nhận request đầu tiên
getDb();

const app = createApp();

app.listen(config.server.port, () => {
  console.log(`Server đang chạy tại http://localhost:${config.server.port}`);
});
