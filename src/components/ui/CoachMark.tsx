interface CoachMarkProps {
  targetId: string;
  message: string;
  step: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function CoachMark({
  message,
  step,
  totalSteps,
  onNext,
  onSkip,
}: CoachMarkProps) {
  const isLast = step === totalSteps;

  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] w-[90vw] max-w-md -translate-x-1/2">
      {/* 말풍선 */}
      <div className="rounded-xl bg-[#0D1B2A] p-5 text-white shadow-2xl">
        {/* 단계 표시 */}
        <p className="mb-1 text-xs text-gray-400">
          {step}/{totalSteps}
        </p>

        {/* 안내 메시지 */}
        <p className="text-base leading-relaxed">{message}</p>

        {/* 버튼 영역 */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="min-h-[44px] px-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            건너뛰기
          </button>
          <button
            onClick={onNext}
            className="min-h-[44px] rounded-lg bg-brand-gold px-5 py-2 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors"
          >
            {isLast ? '완료' : '다음'}
          </button>
        </div>
      </div>

      {/* 하단 화살표 포인터 */}
      <div className="flex justify-center">
        <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[#0D1B2A]" />
      </div>
    </div>
  );
}
