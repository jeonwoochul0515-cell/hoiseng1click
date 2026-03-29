import { useState, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ExternalLink,
  Upload,
  Camera,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import type { Debt, Asset } from '@/types/client';
import type { DocCategory } from '@/types/document';
import { generateDocButtons, type DocButton } from '../../utils/requiredDocs';
import { BANK_CERT_DIRECTORY } from '../../utils/bankDirectory';
import ExternalLinkButton from './ExternalLinkButton';

// ── Props ──

interface ChecklistStepProps {
  debts: Debt[];
  assets: Asset[];
  clientInfo: {
    jobType?: string;
    hasRealEstate?: boolean;
    court?: string;
  };
  onComplete: () => void;
}

// ── 카테고리 라벨 및 순서 ──

const CATEGORY_META: Record<DocCategory, { label: string; order: number }> = {
  basic: { label: '기본서류', order: 0 },
  bank: { label: '은행 부채증명서', order: 1 },
  card: { label: '카드 채무확인서', order: 2 },
  insurance: { label: '보험 해약환급금', order: 3 },
  income: { label: '소득 증빙', order: 4 },
  asset: { label: '재산 관련', order: 5 },
  etc: { label: '기타 서류', order: 6 },
};

// ── 컴포넌트 ──

export default function ChecklistStep({
  debts,
  assets,
  clientInfo,
  onComplete,
}: ChecklistStepProps) {
  // 서류 목록 생성
  const initialButtons = useMemo(
    () =>
      generateDocButtons(debts, assets, {
        hasRealEstate: clientInfo.hasRealEstate,
        jobType: clientInfo.jobType,
      }),
    [debts, assets, clientInfo.hasRealEstate, clientInfo.jobType],
  );

  // 각 서류의 상태를 로컬로 관리
  const [docStatuses, setDocStatuses] = useState<
    Record<string, DocButton['status']>
  >(() => {
    const map: Record<string, DocButton['status']> = {};
    for (const btn of initialButtons) {
      map[btn.id] = btn.status;
    }
    return map;
  });

  // 아코디언 열림 상태 (카테고리별)
  const [openCategories, setOpenCategories] = useState<Set<DocCategory>>(
    () => new Set<DocCategory>(['basic', 'bank', 'card', 'insurance', 'income', 'asset', 'etc']),
  );

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<DocCategory, DocButton[]>();
    for (const btn of initialButtons) {
      const cat = btn.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(btn);
    }
    // 정렬
    const sorted = [...map.entries()].sort(
      (a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99),
    );
    return sorted;
  }, [initialButtons]);

  // 통계
  const totalCount = initialButtons.length;
  const completedCount = initialButtons.filter(
    (b) => docStatuses[b.id] === 'auto' || docStatuses[b.id] === 'uploaded' || docStatuses[b.id] === 'verified',
  ).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount === totalCount;

  // 상태 변경 헬퍼
  const markStatus = useCallback((id: string, status: DocButton['status']) => {
    setDocStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  // 아코디언 토글
  const toggleCategory = useCallback((cat: DocCategory) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // 완료 버튼
  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── 진행률 바 ── */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">서류 수집 체크리스트</h2>
          <span className="text-sm font-medium text-gray-600">
            {completedCount}/{totalCount}건 완료 ({progressPct}%)
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── 카테고리별 아코디언 ── */}
      {grouped.map(([category, items]) => {
        const meta = CATEGORY_META[category] ?? { label: category, order: 99 };
        const isOpen = openCategories.has(category);
        const catCompleted = items.filter(
          (b) =>
            docStatuses[b.id] === 'auto' ||
            docStatuses[b.id] === 'uploaded' ||
            docStatuses[b.id] === 'verified',
        ).length;

        return (
          <div
            key={category}
            className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden"
          >
            {/* 아코디언 헤더 */}
            <button
              onClick={() => toggleCategory(category)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{meta.label}</span>
                <span className="text-xs text-gray-500">
                  ({catCompleted}/{items.length})
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 아코디언 본문 */}
            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {items.map((doc) => (
                  <DocItem
                    key={doc.id}
                    doc={doc}
                    status={docStatuses[doc.id]}
                    onMarkUploaded={() => markStatus(doc.id, 'uploaded')}
                  />
                ))}

                {/* 보험 카테고리일 때 통합조회 안내 */}
                {category === 'insurance' && items.length > 0 && (
                  <div className="flex items-start gap-2 px-5 py-3 bg-amber-50">
                    <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <span className="font-medium">통합조회:</span>{' '}
                      <a
                        href="https://insure.or.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline hover:text-amber-900"
                      >
                        내보험다보여
                        <ExternalLink size={12} />
                      </a>{' '}
                      에서 전체 보험 계약을 한번에 조회할 수 있습니다.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── 하단 버튼 ── */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {!allDone && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle size={16} />
            <span>
              미완료 항목이 {totalCount - completedCount}건 있습니다.
            </span>
          </div>
        )}
        <button
          onClick={handleComplete}
          className={`w-full rounded-xl px-6 py-3.5 text-base font-semibold transition-colors ${
            allDone
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-800 hover:bg-gray-900 text-white'
          }`}
        >
          {allDone ? '다음 단계' : '미완료 항목이 있지만 다음으로'}
        </button>
      </div>
    </div>
  );
}

// ── 개별 서류 항목 ──

interface DocItemProps {
  doc: DocButton;
  status: DocButton['status'];
  onMarkUploaded: () => void;
}

function DocItem({ doc, status, onMarkUploaded }: DocItemProps) {
  const isComplete = status === 'auto' || status === 'uploaded' || status === 'verified';
  const bankInfo = BANK_CERT_DIRECTORY[doc.institution];

  // 자동 수집 완료 항목
  if (isComplete) {
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{doc.docType}</span>
            {doc.codefData && (
              <span className="text-xs text-gray-500">
                ({doc.codefData.count}건, {(doc.codefData.amount / 10000).toFixed(0)}만원)
              </span>
            )}
          </div>
          <p className="text-xs text-emerald-600 mt-0.5">
            {status === 'auto' && '자동 수집 완료'}
            {status === 'uploaded' && '업로드 완료'}
            {status === 'verified' && '검증 완료'}
          </p>
        </div>
      </div>
    );
  }

  // 미완료 항목 (URL 있는 경우)
  if (doc.url) {
    return (
      <div className="px-5 py-3">
        <div className="flex items-start gap-3">
          <Circle size={20} className="text-gray-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {doc.institution}
                {doc.codefData && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({doc.codefData.count}건, {(doc.codefData.amount / 10000).toFixed(0)}만원)
                  </span>
                )}
              </span>
            </div>

            <ExternalLinkButton
              url={doc.url}
              label={doc.institution}
              certName={doc.docType}
              path={bankInfo?.path || doc.description}
              icon={<span className="text-base">{doc.icon}</span>}
              status={status === 'todo' ? 'todo' : status}
              onUploaded={onMarkUploaded}
            />
          </div>
        </div>
      </div>
    );
  }

  // 미완료 항목 (URL 없는 경우 - 업로드 필요)
  return (
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
        <Circle size={20} className="text-gray-300 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-900">{doc.docType}</span>
            {doc.description && (
              <span className="text-xs text-gray-500 ml-2">- {doc.description}</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onMarkUploaded}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Upload size={14} />
              파일 업로드
            </button>
            <button
              onClick={onMarkUploaded}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Camera size={14} />
              촬영
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
