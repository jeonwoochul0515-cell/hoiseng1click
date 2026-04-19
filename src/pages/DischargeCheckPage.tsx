import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, ArrowLeft, ArrowUpRight,
  CheckCircle, Info, Heart,
} from 'lucide-react';

const DISCHARGE_ITEMS = [
  {
    id: 'gambling',
    label: '도박(온라인/오프라인)으로 인한 채무가 전체의 상당 부분을 차지하나요?',
    guidance: '도박 채무가 있더라도 GA(도박중독자 자조모임) 참석 기록, 치료 기록, 반성문 등으로 재량면책을 받을 수 있습니다.',
  },
  {
    id: 'cardKkang',
    label: '신용카드로 물건을 사서 현저히 낮은 가격에 되팔았나요? (카드깡)',
    guidance: '카드깡 경험이 있더라도 규모와 횟수, 이후 성실한 태도에 따라 재량면책이 가능합니다.',
  },
  {
    id: 'partialPay',
    label: '이미 갚을 능력이 없는 상태에서 특정 채권자에게만 갚았나요?',
    guidance: '편파변제에 해당할 수 있지만, 생활에 필수적인 지출이었다면 소명이 가능합니다.',
  },
  {
    id: 'omitDebt',
    label: '채무 신고 시 일부 채무를 고의로 누락하려 하나요?',
    guidance: '정직한 신고가 가장 중요합니다. 숨기면 오히려 불리합니다. 모든 채무를 빠짐없이 신고하세요.',
  },
  {
    id: 'transferAsset',
    label: '재산을 가족이나 타인 명의로 이전한 적이 있나요?',
    guidance: '재산 이전 사실을 정직하게 밝히고, 사유를 소명하면 재량면책이 가능할 수 있습니다.',
  },
  {
    id: 'priorDischarge',
    label: '면책일로부터 5년 이내에 면책결정을 받은 적이 있나요?',
    guidance: '면책일로부터 5년 이내에는 재신청이 제한됩니다 (채무자회생법 제624조). 다만 기각·폐지된 경우에는 재신청 가능합니다.',
  },
];

export default function DischargeCheckPage() {
  const navigate = useNavigate();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkedCount = checkedItems.size;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate('/my')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={16} />
        내 회생 현황으로 돌아가기
      </button>

      {/* 헤더 */}
      <div className="rounded-xl bg-gradient-to-br from-[#48B5A0]/10 to-[#FFF8F0] border border-[#48B5A0]/20 p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck size={28} className="text-[#48B5A0]" />
          <h1 className="text-2xl font-bold text-gray-900">면책 가능성 자가확인</h1>
        </div>
        <p className="text-sm text-gray-600">
          아래는 법원이 면책불허가 사유로 판단할 수 있는 항목입니다. 해당되는 항목을 체크해보세요.
        </p>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-3 rounded-xl bg-[#FFF8F0] border border-amber-200 p-4">
        <Info size={20} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-800">해당되더라도 바로 불가가 아닙니다</p>
          <p className="text-xs text-amber-700">
            재량면책이 가능하며, 법원은 반성과 변제 의지를 종합적으로 판단합니다.
            정직한 신고가 가장 중요합니다. 숨기면 오히려 불리합니다.
          </p>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          면책이 어려울 수 있는 경우
        </h2>
        <p className="text-xs text-gray-500 mb-4">해당 항목을 체크해보세요</p>

        <div className="space-y-3">
          {DISCHARGE_ITEMS.map((item) => {
            const checked = checkedItems.has(item.id);
            return (
              <div key={item.id}>
                <div
                  onClick={() => toggleCheck(item.id)}
                  className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
                    checked
                      ? 'border-[#48B5A0]/40 bg-[#48B5A0]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      checked
                        ? 'border-[#48B5A0] bg-[#48B5A0] text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {checked && <CheckCircle size={12} />}
                  </div>
                  <p className={`text-sm ${checked ? 'text-gray-700 font-medium' : 'text-gray-700'}`}>
                    {item.label}
                  </p>
                </div>
                {checked && (
                  <div className="ml-8 mt-2 flex items-start gap-2 rounded-lg bg-[#48B5A0]/5 border border-[#48B5A0]/20 p-3">
                    <Heart size={14} className="mt-0.5 shrink-0 text-[#48B5A0]" />
                    <p className="text-xs text-[#2B8C8C]">{item.guidance}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 체크 결과 안내 */}
      {checkedCount > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-[#0D1B2A] to-[#1a3050] p-6 text-white">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-brand-gold" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-gold mb-1">
                {checkedCount}개 항목에 해당됩니다
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                걱정되시면 SELF+ 변호사 상담을 이용하세요.
                전문가가 면책 가능성을 정확히 판단해 드립니다.
              </p>
              <button
                onClick={() => navigate('/my/upgrade')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-bold text-black hover:bg-[#b8973e] transition-colors"
              >
                SELF+ 업그레이드 <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {checkedCount === 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} className="text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">면책불허가 사유에 해당되지 않습니다</p>
              <p className="text-xs text-emerald-600 mt-0.5">현재 확인된 사항으로는 면책에 큰 문제가 없을 것으로 보입니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* 참고 정보 */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Info size={16} className="text-gray-500" />
          참고 정보
        </h3>
        <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-[#48B5A0]" />
            <p>
              <strong>도박 채무</strong>의 경우, GA(도박중독자 자조모임) 참석 기록, 정신건강의학과 치료 기록,
              반성문 등을 제출하면 재량면책 가능성이 높아집니다.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-[#48B5A0]" />
            <p>
              <strong>재량면책</strong>은 채무자회생법 제564조에 근거하며, 법원은 채무자의 반성 정도,
              변제 의지, 면책불허가 사유의 경중을 종합적으로 판단합니다.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-[#48B5A0]" />
            <p>
              가장 중요한 것은 <strong>정직한 신고</strong>입니다.
              채무나 재산을 숨기면 면책불허가 사유에 해당될 뿐 아니라 형사처벌 대상이 될 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
