import { useState, useCallback } from 'react';

const COACH_STEPS = [
  { targetId: 'btn-add-client', message: '여기를 눌러 첫 의뢰인을 등록해보세요.' },
  { targetId: 'sidebar-nav-documents', message: '서류 생성 메뉴에서 법원 제출 서류를 만들 수 있습니다.' },
  { targetId: 'sidebar-nav-settings', message: '설정에서 CODEF를 연결하면 금융데이터를 자동 수집합니다.' },
];

const STORAGE_KEY = 'coachmark_completed';

export function useCoachMark(clientCount: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );

  // 의뢰인 0명이고 아직 완료하지 않은 경우에만 표시
  const isActive = clientCount === 0 && !dismissed;

  const step = COACH_STEPS[currentStep];

  const next = useCallback(() => {
    if (currentStep < COACH_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // 마지막 단계 → 완료
      localStorage.setItem(STORAGE_KEY, 'true');
      setDismissed(true);
    }
  }, [currentStep]);

  const skip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }, []);

  return {
    isActive,
    step: step
      ? {
          targetId: step.targetId,
          message: step.message,
          stepNumber: currentStep + 1,
          totalSteps: COACH_STEPS.length,
        }
      : null,
    next,
    skip,
  };
}
