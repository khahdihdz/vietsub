'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Project } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không kết nối được backend.'))
      .finally(() => setLoading(false));
  }, []);

  const createProject = async () => {
    if (!name.trim()) return;
    try {
      const project = await api.createProject(name.trim());
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tạo project thất bại.');
    }
  };

  return (
    <main className="min-h-screen bg-void px-6 py-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Việt Hóa Phụ Đề Video</h1>
        <p className="text-sm text-muted mt-1">Dịch có ngữ cảnh, glossary, và nhân vật — bằng DeepSeek V4 Pro.</p>
      </header>

      {error && (
        <div className="mb-6 px-3 py-2 rounded bg-danger/10 border border-danger/40 text-danger text-sm">
          {error}. Kiểm tra backend đang chạy tại <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code>.
        </div>
      )}

      <div className="flex gap-2 mb-8">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createProject()}
          placeholder="Tên project mới…"
          className="flex-1 bg-surface border border-hair rounded px-3 py-2 text-sm focus:outline-none focus:border-teal/60"
        />
        <button
          onClick={createProject}
          className="px-4 py-2 text-sm rounded bg-teal/20 text-teal border border-teal/40 hover:bg-teal/30 transition-colors"
        >
          Tạo project
        </button>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-muted mb-3">Project của bạn</h2>
        {loading && <p className="text-sm text-muted">Đang tải…</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-muted">Chưa có project nào. Tạo project đầu tiên ở trên.</p>
        )}
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/project/${p.id}`)}
              className="text-left px-4 py-3 rounded-lg bg-surface border border-hair hover:border-teal/50 transition-colors"
            >
              <p className="text-sm text-ink">{p.name}</p>
              <p className="text-[11px] text-muted font-mono mt-0.5">
                Cập nhật {new Date(p.updatedAt).toLocaleString('vi-VN')}
              </p>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
