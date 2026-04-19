import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Phone, MessageSquare, FileCheck, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { INDIVIDUAL_PLAN_CONFIGS } from '@/types/subscription';
import type { IndividualPlanType } from '@/types/subscription';

const PLAN_ORDER: IndividualPlanType[] = ['self', 'self_plus', 'full'];

const PLAN_ICONS: Record<IndividualPlanType, typeof Sparkles> = {
  self: FileCheck,
  self_plus: MessageSquare,
  full: Phone,
};

const PLAN_COLORS: Record<IndividualPlanType, { border: string; bg: string; badge: string }> = {
  self: { border: 'border-gray-300', bg: 'bg-white', badge: 'bg-gray-100 text-gray-700' },
  self_plus: { border: 'border-brand-gold', bg: 'bg-brand-gold/5', badge: 'bg-brand-gold/20 text-brand-gold' },
  full: { border: 'border-purple-400', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
};

export default function IndividualUpgradePage() {
  const navigate = useNavigate();
  const individual = useAuthStore((s) => s.individual);
  const currentPlan = individual?.plan as IndividualPlanType | null;
  const [consultName, setConsultName] = useState('');
  const [consultPhone, setConsultPhone] = useState('');
  const [consultSent, setConsultSent] = useState(false);

  const handleSelectPlan = (plan: IndividualPlanType) => {
    if (plan === 'full') return; // FULL은 상담 폼으로 처리
    // TODO: 토스페이먼츠 결제 연동
    alert(`${INDIVIDUAL_PLAN_CONFIGS[plan].name} 플랜 결제 기능은 준비 중입니다.`);
  };

  const handleConsultRequest = async () => {
    if (!consultName.trim() || !consultPhone.trim()) return;
    try {
      const { addDoc, collection, Timestamp } = await import('firebase/firestore');
      const { db } = await import('@/firebase');
      await addDoc(collection(db, 'retainerRequests'), {
        name: consultName.trim(),
        phone: consultPhone.trim(),
        userId: individual?.id ?? '',
        plan: 'full',
        createdAt: Timestamp.now(),
        status: 'pending',
      });
      setConsultSent(true);
    } catch (err) {
      console.error('상담 요청 저장 실패:', err);
      alert('상담 요청에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/my')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">플랜 선택</h1>
          <p className="mt-1 text-sm text-gray-500">나에게 맞는 플랜을 선택하세요</p>
        </div>
      </div>

      {/* 플랜 비교 카드 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const config = INDIVIDUAL_PLAN_CONFIGS[planId];
          const colors = PLAN_COLORS[planId];
          const Icon = PLAN_ICONS[planId];
          const isCurrent = currentPlan === planId;
          const isRecommended = planId === 'self_plus';

          return (
            <div
              key={planId}
              className={`relative rounded-xl border-2 p-6 transition-all ${colors.border} ${colors.bg} ${
                isRecommended ? 'ring-2 ring-brand-gold/30' : ''
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold text-black">
                    <Sparkles size={12} /> 추천
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.badge}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{config.name}</h3>
                  <p className="text-sm text-gray-500">{config.priceLabel}</p>
                </div>
              </div>

              <div className="mb-6 space-y-2">
                {config.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {planId === 'full' ? (
                // FULL은 상담 요청 폼
                consultSent ? (
                  <div className="rounded-lg bg-emerald-50 p-4 text-center">
                    <CheckCircle size={24} className="mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-700">상담 요청 완료</p>
                    <p className="mt-1 text-xs text-emerald-600">담당 변호사가 24시간 내에 연락드리겠습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={consultName}
                      onChange={(e) => setConsultName(e.target.value)}
                      placeholder="성명"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                    />
                    <input
                      type="tel"
                      value={consultPhone}
                      onChange={(e) => setConsultPhone(e.target.value)}
                      placeholder="연락처 (010-0000-0000)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                    />
                    <button
                      onClick={handleConsultRequest}
                      disabled={!consultName.trim() || !consultPhone.trim()}
                      className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      변호사 상담 요청
                    </button>
                  </div>
                )
              ) : isCurrent ? (
                <div className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-500">
                  현재 플랜
                </div>
              ) : (
                <button
                  onClick={() => handleSelectPlan(planId)}
                  className={`w-full rounded-lg py-2.5 text-sm font-bold transition-colors ${
                    isRecommended
                      ? 'bg-brand-gold text-black hover:bg-[#b8973e]'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {currentPlan ? `${config.name}으로 업그레이드` : `${config.name} 시작하기`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 하단 안내 */}
      <div className="rounded-xl bg-gray-50 p-5 text-center">
        <p className="text-sm text-gray-600">
          결제 후 즉시 이용 가능합니다. 환불 규정은 <span className="font-semibold">7일 이내 미사용 시 전액 환불</span>입니다.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          SELF에서 SELF+로 업그레이드 시 차액(100,000원)만 결제됩니다.
        </p>
      </div>
    </div>
  );
}
