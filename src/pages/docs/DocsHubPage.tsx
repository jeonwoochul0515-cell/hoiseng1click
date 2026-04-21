import { Link } from 'react-router-dom';
import { listDocTemplates } from '@/data/docTemplates';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';

/**
 * 5종 문서 선택 허브.
 * 문서 자체가 주인공. 카드를 A4 미니어처 느낌으로.
 */
export default function DocsHubPage() {
  const templates = listDocTemplates();
  // 진행률은 localStorage 기반 mock (실구현 시 Firestore에서 조회)
  const progressMap = readProgress();

  const completed = templates.filter((t) => (progressMap[t.type] ?? 0) >= 100).length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">개인회생 서류</h1>
        <p className="text-gray-500 mt-2">
          법원에 제출할 5종 서류를 한 번의 인증으로 자동 작성합니다.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-xs">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(completed / templates.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 font-medium">
            {completed} / {templates.length} 완성
          </span>
        </div>
      </div>

      {/* 5종 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => {
          const progress = progressMap[t.type] ?? 0;
          const isDone = progress >= 100;
          const isStarted = progress > 0;

          return (
            <Link
              key={t.type}
              to={`/my/docs/${t.type}`}
              className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* A4 미니어처 상단 */}
              <div className="relative bg-gradient-to-b from-gray-50 to-white aspect-[3/4] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-4 bg-white border border-gray-200 shadow-sm rounded-sm flex flex-col items-center justify-start pt-8 px-4">
                  <div className="text-4xl mb-3">{t.icon}</div>
                  <div className="text-center text-xs text-gray-400 font-serif border-b border-gray-200 pb-2 mb-2 w-full">
                    {t.title}
                  </div>
                  {/* 문서 줄 (스켈레톤 느낌) */}
                  <div className="w-full space-y-1.5 mt-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1 bg-gray-100 rounded"
                        style={{ width: `${70 + ((i * 13) % 30)}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* 완료 뱃지 */}
                {isDone && (
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                    ✓ 완성
                  </div>
                )}
                {isStarted && !isDone && (
                  <div className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">
                    {Math.round(progress)}%
                  </div>
                )}
              </div>

              {/* 카드 하단 메타 */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{t.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{t.description}</p>

                {/* 필요 API 미니 칩 */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.requiredSources.slice(0, 4).map((sid) => {
                    const s = SOURCE_CATALOG[sid];
                    if (!s) return null;
                    return (
                      <span
                        key={sid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-[10px] text-gray-600"
                      >
                        <span>{s.icon}</span>
                        {s.label.split(' · ')[0]}
                      </span>
                    );
                  })}
                  {t.requiredSources.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{t.requiredSources.length - 4}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{t.subtitle}</span>
                  <span className="text-sm font-medium text-brand-gold group-hover:translate-x-1 transition-transform">
                    {isDone ? '다시 보기' : isStarted ? '계속' : '만들기'} →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 안내 */}
      <div className="mt-10 p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">각 문서를 만드는 데 걸리는 시간</h4>
            <p className="text-sm text-blue-800">
              공동인증서 1회 인증 후, 각 서류는 <strong>약 7~10초</strong> 내에 완성됩니다.
              API로 수집된 정보는 즉시 문서에 반영되며, 잘못된 값은 언제든 편집할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** localStorage 기반 임시 진행률 (실구현 시 Firestore로 대체) */
function readProgress(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('docgen-progress');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
