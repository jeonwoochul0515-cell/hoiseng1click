// 부가신청서(금지/중지/면제재산) 제출 전 사건확인 모달
// 전자소송 포털 "사건확인" 화면을 그대로 재현
import { useState } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import { COURTS, parseCaseNumber, getRehabilitationCourt, CASE_TYPES } from '@/utils/legalConstants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docLabel: string; // "금지명령 신청서" 등
  initialCourt?: string;
  initialCaseYear?: number;
  initialCaseType?: string;
  initialCaseNumber?: string;
  initialFilingDate?: string;
  onConfirm: (data: {
    court: string;
    caseYear: number;
    caseType: string;
    caseNumber: string;
    fullCaseNumber: string;
    rehabilitationCourt: string;
    filingDate: string;
  }) => void;
}

export function CaseNumberModal({
  isOpen,
  onClose,
  docLabel,
  initialCourt = '',
  initialCaseYear = new Date().getFullYear(),
  initialCaseType = '개회',
  initialCaseNumber = '',
  initialFilingDate = '',
  onConfirm,
}: Props) {
  const [court, setCourt] = useState(initialCourt);
  const [year, setYear] = useState(initialCaseYear);
  const [caseType, setCaseType] = useState(initialCaseType);
  const [num, setNum] = useState(initialCaseNumber);
  const [filingDate, setFilingDate] = useState(initialFilingDate);

  if (!isOpen) return null;

  const full = num ? `${year}${caseType}${num}` : '';
  const parsed = parseCaseNumber(full);
  const rehabCourt = getRehabilitationCourt(court, filingDate || undefined);
  const courtChanged = court && rehabCourt && rehabCourt !== court;
  const canSubmit = !!court && parsed.valid;

  const handleConfirm = () => {
    if (!canSubmit || !parsed.valid) return;
    onConfirm({
      court,
      caseYear: parsed.year!,
      caseType: parsed.caseType!,
      caseNumber: parsed.number!,
      fullCaseNumber: parsed.formatted!,
      rehabilitationCourt: rehabCourt,
      filingDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="border-b p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                <span className="text-blue-600">●</span> 회생파산 서류 ({docLabel})
              </h2>
              <p className="text-sm font-semibold text-blue-600 mt-2">사건확인</p>
              <p className="text-xs text-gray-500 mt-0.5">서류를 제출할 사건기본정보를 입력하시기 바랍니다.</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-5 bg-gray-50">
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-gray-700">소송유형</label>
              <div className="px-3 py-2 text-sm bg-white border border-gray-300 rounded text-gray-600">
                회생파산
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                법원 <span className="text-red-500">*</span>
              </label>
              <select
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">선택</option>
                {COURTS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-[100px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                사건번호 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded w-24"
                >
                  {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-gray-300 rounded w-24"
                >
                  {CASE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.value}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={num}
                  onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="번호"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-gray-700">접수일</label>
              <input
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded w-52"
              />
            </div>
          </div>

          {/* 회생법원 이관 안내 */}
          {courtChanged && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900">
                  <strong>회생법원 이관 대상</strong><br />
                  {court} 회생파산사건은 회생법원으로 이관되어
                  <strong> {rehabCourt}</strong>에서 조회/제출합니다.
                  서류는 <strong>{rehabCourt}</strong>로 자동 변경되어 생성됩니다.
                </div>
              </div>
            </div>
          )}

          {/* 사건번호 검증 결과 */}
          {num && !parsed.valid && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <div className="text-xs text-red-900">
                  <strong>사건번호 형식 오류</strong><br />
                  1998년 이후 사건만 가능합니다. 형식: YYYY-개회-NNNNN
                </div>
              </div>
            </div>
          )}
          {parsed.valid && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
              <div className="flex gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                <div className="text-xs text-green-900">
                  사건번호 <strong>{parsed.formatted}</strong> 확인 완료
                </div>
              </div>
            </div>
          )}

          {/* 참고사항 */}
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs font-semibold text-blue-900 mb-1.5">💡 참고하세요</p>
            <ul className="text-[11px] text-blue-800 space-y-0.5">
              <li>• 1998년도 이전 접수된 사건은 제출 제한</li>
              <li>• 서울중앙지방법원 회생파산사건은 2017.3.1부터 서울회생법원으로 조회</li>
              <li>• 수원·부산지방법원 회생파산사건은 2023.3.1부터 해당 회생법원으로 조회</li>
              <li>• 광주·대전·대구지방법원 회생파산사건은 2026.3.1부터 해당 회생법원으로 조회</li>
            </ul>
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={`px-6 py-2 text-sm font-medium text-white rounded ${
              canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
