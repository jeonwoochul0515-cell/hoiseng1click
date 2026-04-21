import type { ReactNode } from 'react';
import SourceBadge, { type SourceItem } from './SourceBadge';

export type CanvasState = 'idle' | 'generating' | 'paused' | 'editing' | 'done';

interface DocumentCanvasProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  sources: SourceItem[];
  state: CanvasState;
  progress?: number; // 0~100
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEditToggle?: () => void;
  onDownload?: () => void;
}

/**
 * A4 느낌의 문서 캔버스.
 * - 상단: 출처 칩 스택 (플로팅)
 * - 중앙: 문서 본문 (A4 비율, 그림자)
 * - 하단: 컨트롤 바
 */
export default function DocumentCanvas({
  title,
  subtitle,
  children,
  sources,
  state,
  progress = 0,
  onStart,
  onPause,
  onResume,
  onEditToggle,
  onDownload,
}: DocumentCanvasProps) {
  return (
    <div className="relative flex flex-col h-full">
      {/* 상단 메타 바 */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <StateBadge state={state} />
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-4 mx-2">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 출처 칩 스택 (플로팅) */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 px-2 min-h-[2rem]">
          {sources.map((s, i) => (
            <SourceBadge key={s.id} item={s} delayMs={i * 80} />
          ))}
        </div>
      )}

      {/* 문서 본문 (A4) */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div
          className={[
            'mx-auto bg-white shadow-lg rounded-sm border border-gray-200',
            'max-w-[794px] min-h-[1123px] px-16 py-20',
            'font-serif text-gray-900 leading-relaxed',
            state === 'generating' ? 'ring-2 ring-amber-300/40' : '',
          ].join(' ')}
        >
          {children}
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        {state === 'idle' && (
          <button
            onClick={onStart}
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold/90 text-white font-medium rounded-lg shadow-sm transition-all"
          >
            ▶ 서류 생성 시작
          </button>
        )}

        {state === 'generating' && (
          <>
            <button
              onClick={onPause}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ⏸ 일시정지
            </button>
            <span className="text-sm text-gray-500 animate-pulse">작성 중…</span>
          </>
        )}

        {state === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="px-4 py-2 bg-brand-gold text-white rounded-lg"
            >
              ▶ 계속 작성
            </button>
            <button
              onClick={onEditToggle}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ✎ 편집 모드
            </button>
          </>
        )}

        {state === 'editing' && (
          <>
            <span className="text-sm text-amber-700 font-medium">✎ 편집 중 — 아무 글자나 클릭하여 수정</span>
            <button
              onClick={onEditToggle}
              className="ml-auto px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              편집 완료
            </button>
          </>
        )}

        {state === 'done' && (
          <>
            <span className="text-sm text-emerald-700 font-medium">✓ 서류가 준비됐습니다</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={onEditToggle}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                ✎ 수정
              </button>
              <button
                onClick={onDownload}
                className="px-6 py-2 bg-brand-gold hover:bg-brand-gold/90 text-white font-medium rounded-lg shadow-sm"
              >
                ⬇ 다운로드
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: CanvasState }) {
  const map: Record<CanvasState, { text: string; cls: string }> = {
    idle: { text: '대기', cls: 'bg-gray-100 text-gray-600' },
    generating: { text: '작성 중', cls: 'bg-amber-100 text-amber-700' },
    paused: { text: '일시정지', cls: 'bg-blue-100 text-blue-700' },
    editing: { text: '편집 중', cls: 'bg-purple-100 text-purple-700' },
    done: { text: '완료', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const m = map[state];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${m.cls}`}>{m.text}</span>
  );
}
