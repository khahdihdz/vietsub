/**
 * Ví dụ chạy thử pipeline lõi: dịch → proofread → QA.
 * Yêu cầu VILAO_API_KEY thật trong .env để chạy được (gọi API thật,
 * không mock — đúng yêu cầu mục 30 của spec).
 *
 * Chạy: npm run start:example
 */
import { VilaoProvider } from '../services/ai/VilaoProvider.js';
import { TranslationService } from '../services/translation/translationService.js';
import { ProofreadService } from '../services/proofread/proofreadService.js';
import { QAService } from '../services/qa/qaService.js';
import { InMemoryCacheStore } from '../services/cache/cacheService.js';
import { Character, GlossaryEntry, SubtitleEntry } from '../types/subtitle.js';

async function main() {
  const subtitles: SubtitleEntry[] = [
    { id: 1, start: 0.52, end: 2.1, speaker: 'char_a', original: "You've got to be kidding me." },
    { id: 2, start: 2.3, end: 4.0, speaker: 'char_b', original: 'Long time no see.' },
    { id: 3, start: 4.2, end: 6.5, speaker: 'char_a', original: 'What are you talking about?' },
  ];

  const glossary: GlossaryEntry[] = [{ term: 'kidding', translation: 'đùa' }];

  const characters: Character[] = [
    { id: 'char_a', name: 'A', gender: 'Nam', age: 35, role: 'Sư phụ', addressing: { char_b: 'con' } },
    { id: 'char_b', name: 'B', gender: 'Nam', age: 18, role: 'Đệ tử', addressing: { char_a: 'sư phụ' } },
  ];

  const ai = new VilaoProvider();
  const cache = new InMemoryCacheStore();
  const translationService = new TranslationService(ai, cache);
  const proofreadService = new ProofreadService(ai);
  const qaService = new QAService();

  console.log('Đang dịch...');
  const { subtitles: translated, failedIds } = await translationService.translate(subtitles, {
    glossary,
    characters,
    style: 'tu_nhien',
    onProgress: (done, total) => console.log(`Dịch: ${done}/${total}`),
  });

  if (failedIds.length > 0) {
    console.log('Các dòng lỗi, thử lại:', failedIds);
    const retry = await translationService.retryFailed(translated, failedIds, {
      glossary,
      characters,
      style: 'tu_nhien',
    });
    Object.assign(translated, retry.subtitles);
  }

  console.log('Đang proofread...');
  const { subtitles: proofed, corrections } = await proofreadService.proofread(translated, 'all', {
    glossary,
    characters,
    style: 'tu_nhien',
  });
  console.log(`Số dòng được sửa ở bước proofread: ${corrections.length}`);

  console.log('Đang chạy QA...');
  const issues = qaService.check(proofed, glossary, characters);

  console.log('\n=== KẾT QUẢ ===');
  for (const s of proofed) {
    console.log(`${s.id}. [${s.speaker}] ${s.original}\n   → ${s.translation}`);
  }
  if (issues.length > 0) {
    console.log('\n=== CẢNH BÁO QA ===');
    for (const issue of issues) {
      console.log(`⚠ #${issue.subtitleId} (${issue.type}): ${issue.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Lỗi khi chạy pipeline:', err);
  process.exit(1);
});
