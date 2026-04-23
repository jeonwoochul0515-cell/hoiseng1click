import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { listDocMeta } from '@/data/docTemplates';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';
import { useAuthStore } from '@/store/authStore';
import { useClients } from '@/hooks/useClients';
import { useCurrentClient } from '@/hooks/useCurrentClient';
import { formatPhone } from '@/utils/formatter';
import type { Client } from '@/types/client';

type ProgressMap = Record<string, number>;

/**
 * 5종 문서 선택 허브.
 * - B2B: 좌측에 의뢰인 선택 패널, clientId 가 정해져야 카드 활성화
 * - B2C: 데모 모드 배너 + 바로 카드 활성화 (데모 의뢰인 사용)
 */
export default function DocsHubPage() {
  const location = useLocation();
  const isB2B = location.pathname.startsWith('/docs-gen');
  const basePath = isB2B ? '/docs-gen' : '/my/docs';

  const userType = useAuthStore((s) => s.userType);
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');

  // B2B 전용: 의뢰인 목록 로드
  const clientsQuery = useClients();
  const [searchQuery, setSearchQuery] = useState('');

  // B2C: 본인 실데이터 로드 (B2B 이면 clientId 있을 때만 enabled)
  const currentClientQuery = useCurrentClient(clientId ?? undefined);
  const myClient: Client | null = !isB2B ? (currentClientQuery.data ?? null) : null;
  const hasB2CRealData = !!myClient && !!myClient.id && !!myClient.name;

  const selectedClient: Client | null = useMemo(() => {
    if (!clientId) return null;
    return clientsQuery.data?.find((c) => c.id === clientId) ?? null;
  }, [clientId, clientsQuery.data]);

  const filteredClients = useMemo(() => {
    const list = clientsQuery.data ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [clientsQuery.data, searchQuery]);

  const templates = listDocMeta();
  // B2C 는 본인 UID 버킷으로 진행률 저장
  const progressBucket = clientId ?? (hasB2CRealData ? (myClient!.id) : 'demo');
  const progressMap = readProgress(progressBucket);
  const completed = templates.filter((t) => (progressMap[t.type] ?? 0) >= 100).length;

  const requireClient = isB2B && userType === 'office' && !selectedClient;
  // B2C 실데이터 미수집 상태 (로그인 O, 아직 데이터 없음)
  const requireCollection =
    !isB2B && userType === 'individual' && !currentClientQuery.isLoading && !hasB2CRealData;

  function pickClient(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('clientId', id);
    setSearchParams(next, { replace: false });
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
      {/* B2B: 의뢰인 선택 패널 */}
      {isB2B && (
        <aside className="w-full md:w-[280px] md:shrink-0">
          <div className="rounded-xl bg-white border border-gray-200 p-4 md:sticky md:top-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">의뢰인 선택</h2>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름 또는 연락처 검색"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {clientsQuery.isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-gray-400 text-xs">
                  <Users size={22} className="mb-2" />
                  <p>의뢰인이 없습니다</p>
                </div>
              ) : (
                filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickClient(c.id)}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      clientId === c.id
                        ? 'bg-brand-gold/15 text-brand-gold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatPhone(c.phone)}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      )}

      {/* 메인 */}
      <div className="flex-1">
        {/* B2C 데모 모드 배너 — 실데이터 없을 때만 */}
        {!isB2B && !hasB2CRealData && !requireCollection && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <span className="text-2xl">🧪</span>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-1">데모 모드</h4>
              <p className="text-sm text-amber-800">
                로그인하지 않은 상태에서는 가상 의뢰인 데이터로 화면 동작만 체험할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            개인회생 서류
            {selectedClient && <span className="ml-3 text-base font-normal text-gray-500">— {selectedClient.name}</span>}
            {!isB2B && hasB2CRealData && <span className="ml-3 text-base font-normal text-gray-500">— {myClient!.name}</span>}
          </h1>
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

        {requireClient && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-blue-900">
            <strong>왼쪽에서 의뢰인을 먼저 선택</strong>하세요. 선택한 의뢰인의 실제 데이터로 5종 서류가 자동 작성됩니다.
          </div>
        )}

        {requireCollection && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-900 flex items-start gap-3">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">먼저 금융·공공 자료를 수집하세요</h4>
              <p className="text-sm mb-3">
                CODEF 인증 1회로 은행·카드·보험 등 내 금융정보를 자동으로 불러오고, 법원 제출 5종 서류를 자동 생성할 수 있습니다.
              </p>
              <Link
                to="/my/collection"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                자료 수집 시작 →
              </Link>
            </div>
          </div>
        )}

        {/* 5종 카드 그리드 */}
        {!requireClient && !requireCollection && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => {
              const progress = progressMap[t.type] ?? 0;
              const isDone = progress >= 100;
              const isStarted = progress > 0;
              const linkSuffix = clientId ? `?clientId=${clientId}` : '';
              return (
                <Link
                  key={t.type}
                  to={`${basePath}/${t.type}${linkSuffix}`}
                  className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative bg-gradient-to-b from-gray-50 to-white aspect-[3/4] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-4 bg-white border border-gray-200 shadow-sm rounded-sm flex flex-col items-center justify-start pt-8 px-4">
                      <div className="text-4xl mb-3">{t.icon}</div>
                      <div className="text-center text-xs text-gray-400 font-serif border-b border-gray-200 pb-2 mb-2 w-full">
                        {t.title}
                      </div>
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
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{t.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{t.description}</p>
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
        )}

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
    </div>
  );
}

/** 임시 진행률: 의뢰인별 localStorage 버킷. 추후 Firestore 이관 예정. */
function readProgress(bucket: string): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`docgen-progress:${bucket}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
