import { useState } from 'react';
import TypewriterField from './TypewriterField';

/**
 * 랜딩 히어로용 "문서가 자동으로 완성되는" 무한 루프 데모.
 * - 작은 A4 미니 프리뷰
 * - 3개 필드 순차 타이핑 → 3초 쉼 → 다시 처음부터
 * - 각 필드 옆에 출처 칩이 점등
 */

interface DemoField {
  label: string;
  value: string;
  source: string;
  icon: string;
}

const FIELDS: DemoField[] = [
  { label: '성명', value: '홍 길 동', source: '정부24', icon: '🏛' },
  { label: '주소', value: '서울 강남구 테헤란로 123', source: '정부24', icon: '🏛' },
  { label: '월 소득', value: '3,200,000원', source: '홈택스', icon: '📄' },
  { label: '총 채무', value: '62,300,000원 (5건)', source: '은행', icon: '🏦' },
];

export default function HeroDocDemo() {
  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0); // 리셋 카운터

  // 각 필드 완료 시 idx++, 전부 끝나면 3초 후 리셋
  const handleComplete = () => {
    if (idx + 1 < FIELDS.length) {
      setTimeout(() => setIdx(idx + 1), 400);
    } else {
      setTimeout(() => {
        setIdx(0);
        setCycle((c) => c + 1);
      }, 3500);
    }
  };

  // cycle 변경 시 Typewriter re-mount를 위해 key 변경
  return (
    <div
      key={cycle}
      className="mx-auto mt-12 max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-doc-rise"
    >
      {/* 상단 툴바 */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="ml-auto text-[10px] text-gray-400 font-mono">
          개인회생 신청서 · 자동 작성 중
        </div>
      </div>

      {/* 문서 본문 */}
      <div className="relative px-8 py-6 font-serif bg-white">
        <div className="text-center font-bold text-gray-900 border-b border-gray-200 pb-3 mb-5">
          개인회생절차 개시신청서
        </div>

        <div className="space-y-3 text-sm min-h-[180px]">
          {FIELDS.map((f, i) => {
            const visible = i <= idx;
            const isTyping = i === idx;
            if (!visible) return null;
            return (
              <div key={i} className="flex items-start animate-doc-rise">
                <span className="inline-block w-16 text-gray-500 font-sans text-xs">
                  {f.label}
                </span>
                <span className="flex-1 text-gray-900 font-medium">
                  {isTyping ? (
                    <TypewriterField text={f.value} speed={40} onComplete={handleComplete} />
                  ) : (
                    f.value
                  )}
                  {!isTyping && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-[9px] text-emerald-700 font-sans"
                    >
                      <span>{f.icon}</span>
                      <span>{f.source}</span>
                      <span>✓</span>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 상태 바 */}
      <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-gray-100 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] text-gray-600">
          {idx < FIELDS.length - 1 ? 'API에서 실시간으로 가져오는 중' : '문서 완성'}
        </span>
        <span className="ml-auto text-[10px] text-gray-400">
          {idx + 1} / {FIELDS.length}
        </span>
      </div>
    </div>
  );
}
