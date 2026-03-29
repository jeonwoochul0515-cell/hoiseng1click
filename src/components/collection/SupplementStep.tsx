import { useState, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Upload,
  Home,
  Briefcase,
} from 'lucide-react';
import { useCollectionStore } from '@/store/collectionStore';

// ── Props ──

interface SupplementStepProps {
  onComplete: () => void;
}

// ── 주거 유형 ──

type ResidenceType = 'rent' | 'own' | 'free';

// ── 컴포넌트 ──

export default function SupplementStep({ onComplete }: SupplementStepProps) {
  const {
    manualDebts,
    addManualDebt,
    removeManualDebt,
    leaseDeposit,
    leaseMonthly,
    setLeaseInfo,
    retirementEstimate,
    setRetirementEstimate,
    setStep,
    step,
  } = useCollectionStore();

  // 아코디언 열림 상태
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['debt', 'lease', 'retirement']),
  );

  // 해당 없음 체크
  const [noDebt, setNoDebt] = useState(false);
  const [noRetirement, setNoRetirement] = useState(false);

  // 주거 유형
  const [residenceType, setResidenceType] = useState<ResidenceType>('rent');

  // 파일 상태 (로컬)
  const [leaseFile, setLeaseFile] = useState<File | null>(null);
  const [retirementFile, setRetirementFile] = useState<File | null>(null);
  const leaseFileRef = useRef<HTMLInputElement>(null);
  const retirementFileRef = useRef<HTMLInputElement>(null);

  // 새 사채 행 입력 상태
  const [newDebt, setNewDebt] = useState({
    creditorName: '',
    amount: '',
    rate: '',
    borrowDate: '',
    contact: '',
  });

  // 아코디언 토글
  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // 사채 추가
  const handleAddDebt = () => {
    if (!newDebt.creditorName || !newDebt.amount) return;
    addManualDebt({
      creditorName: newDebt.creditorName,
      amount: Number(newDebt.amount),
      rate: Number(newDebt.rate) || 0,
      borrowDate: newDebt.borrowDate,
      contact: newDebt.contact,
    });
    setNewDebt({ creditorName: '', amount: '', rate: '', borrowDate: '', contact: '' });
  };

  // 해당 없음 토글 시 섹션 접기
  const handleNoDebtToggle = () => {
    const next = !noDebt;
    setNoDebt(next);
    if (next) {
      setOpenSections((prev) => {
        const s = new Set(prev);
        s.delete('debt');
        return s;
      });
    }
  };

  const handleNoRetirementToggle = () => {
    const next = !noRetirement;
    setNoRetirement(next);
    if (next) {
      setOpenSections((prev) => {
        const s = new Set(prev);
        s.delete('retirement');
        return s;
      });
    }
  };

  // 주거 유형 변경
  const handleResidenceChange = (type: ResidenceType) => {
    setResidenceType(type);
    if (type !== 'rent') {
      setLeaseInfo(0, 0);
    }
  };

  // 파일 선택
  const handleLeaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setLeaseFile(file);
  };

  const handleRetirementFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRetirementFile(file);
  };

  // 이전/다음
  const handlePrev = () => setStep(step - 1);
  const handleNext = () => onComplete();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── 섹션 1: 사채/개인간 채무 ── */}
      <section className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('debt')}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">사채 / 개인간 채무</span>
            {noDebt && (
              <span className="text-xs text-gray-400 ml-1">해당 없음</span>
            )}
          </div>
          {openSections.has('debt') ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>

        {openSections.has('debt') && !noDebt && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-4">
            {/* 기존 사채 목록 */}
            {manualDebts.length > 0 && (
              <div className="space-y-3">
                {manualDebts.map((debt: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-500">채권자</span>
                        <p className="font-medium text-gray-900">{debt.creditorName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">금액</span>
                        <p className="font-medium text-gray-900">
                          {Number(debt.amount).toLocaleString()}원
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">금리</span>
                        <p className="font-medium text-gray-900">{debt.rate}%</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">차용일</span>
                        <p className="font-medium text-gray-900">{debt.borrowDate || '-'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">연락처</span>
                        <p className="font-medium text-gray-900">{debt.contact || '-'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeManualDebt(idx)}
                      className="self-start sm:self-center p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 새 사채 입력 폼 */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="채권자명"
                value={newDebt.creditorName}
                onChange={(e) => setNewDebt((p) => ({ ...p, creditorName: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder="금액 (원)"
                value={newDebt.amount}
                onChange={(e) => setNewDebt((p) => ({ ...p, amount: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <input
                type="number"
                placeholder="금리 %"
                value={newDebt.rate}
                onChange={(e) => setNewDebt((p) => ({ ...p, rate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <input
                type="date"
                placeholder="차용일"
                value={newDebt.borrowDate}
                onChange={(e) => setNewDebt((p) => ({ ...p, borrowDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                placeholder="연락처"
                value={newDebt.contact}
                onChange={(e) => setNewDebt((p) => ({ ...p, contact: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              onClick={handleAddDebt}
              disabled={!newDebt.creditorName || !newDebt.amount}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={16} />
              사채 추가
            </button>
          </div>
        )}

        {/* 해당 없음 */}
        <div className="border-t border-gray-100 px-5 py-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={noDebt}
              onChange={handleNoDebtToggle}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            해당 없음 (사채 없음)
          </label>
        </div>
      </section>

      {/* ── 섹션 2: 임대차 정보 ── */}
      <section className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('lease')}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Home size={18} className="text-gray-500" />
            <span className="font-semibold text-gray-900">임대차 정보</span>
          </div>
          {openSections.has('lease') ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>

        {openSections.has('lease') && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-4">
            {/* 주거 유형 라디오 */}
            <div className="flex flex-col sm:flex-row gap-3">
              {([
                { value: 'rent' as ResidenceType, label: '임차 (전세/월세)' },
                { value: 'own' as ResidenceType, label: '자가 거주' },
                { value: 'free' as ResidenceType, label: '무상 거주' },
              ]).map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    residenceType === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="residenceType"
                    value={option.value}
                    checked={residenceType === option.value}
                    onChange={() => handleResidenceChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {/* 금액 입력 (임차일 때만) */}
            {residenceType === 'rent' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    보증금 (원)
                  </label>
                  <input
                    type="number"
                    value={leaseDeposit || ''}
                    onChange={(e) =>
                      setLeaseInfo(Number(e.target.value) || 0, leaseMonthly)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    월세 (원)
                  </label>
                  <input
                    type="number"
                    value={leaseMonthly || ''}
                    onChange={(e) =>
                      setLeaseInfo(leaseDeposit, Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* 임대차계약서 업로드 */}
            {residenceType === 'rent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  임대차계약서
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => leaseFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Upload size={16} />
                    파일 선택
                  </button>
                  <span className="text-sm text-gray-500 truncate">
                    {leaseFile ? leaseFile.name : 'PDF, JPG, PNG'}
                  </span>
                  <input
                    ref={leaseFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleLeaseFile}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 섹션 3: 퇴직금 ── */}
      <section className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('retirement')}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-gray-500" />
            <span className="font-semibold text-gray-900">퇴직금</span>
            {noRetirement && (
              <span className="text-xs text-gray-400 ml-1">미취업</span>
            )}
          </div>
          {openSections.has('retirement') ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>

        {openSections.has('retirement') && !noRetirement && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                퇴직금 예상액 (원)
              </label>
              <input
                type="number"
                value={retirementEstimate || ''}
                onChange={(e) => setRetirementEstimate(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                퇴직금증명서
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => retirementFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload size={16} />
                  파일 선택
                </button>
                <span className="text-sm text-gray-500 truncate">
                  {retirementFile ? retirementFile.name : 'PDF, JPG, PNG'}
                </span>
                <input
                  ref={retirementFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleRetirementFile}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* 미취업 체크 */}
        <div className="border-t border-gray-100 px-5 py-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={noRetirement}
              onChange={handleNoRetirementToggle}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            미취업 (해당 없음)
          </label>
        </div>
      </section>

      {/* ── 하단 버튼 ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handlePrev}
          className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          이전 단계
        </button>
        <button
          onClick={handleNext}
          className="w-full sm:flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}
