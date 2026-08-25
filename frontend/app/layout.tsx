import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Việt Hóa Phụ Đề Video',
  description: 'Công cụ Việt hóa phụ đề video có ngữ cảnh, glossary và nhân vật.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
