import { X, Check } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { PLAN_CONFIGS, type PlanType } from '@/types/subscription';

const planOrder: PlanType[] = ['starter', 'pro', 'enterprise'];

const cardBorder: Record<PlanType, string> = {
  starter: 'border-gray-700',
  pro: 'border-[#C9A84C]',
  enterprise: 'border-purple-500',
};

function formatPrice(price: number): string {
  return price.toLocaleString('ko-KR') + '원';
}

export default function UpgradeModal() {
  const { upgradeModalOpen, closeUpgradeModal } = useUiStore();
  const office = useAuthStore((s) => s.office);

  if (!upgradeModalOpen) return null;

  const currentPlan = office?.plan ?? 'starter';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeUpgradeModal}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-[#1F2937] p-8">
        {/* Close button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="mb-2 text-center text-2xl font-bold text-white">
          플랜 선택
        </h2>
        <p className="mb-8 text-center text-sm text-gray-400">
          연간 결제 시 2개월 무료
        </p>

        {/* Plan cards */}
        <div className="grid grid-cols-3 gap-6">
          {planOrder.map((planKey) => {
            const config = PLAN_CONFIGS[planKey];
            const isCurrent = planKey === currentPlan;

            return (
              <div
                key={planKey}
                className={`relative flex flex-col rounded-xl border-2 p-6 ${cardBorder[planKey]} ${
                  isCurrent ? 'bg-white/5' : 'bg-[#111827]'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#C9A84C] px-3 py-0.5 text-xs font-semibold text-black">
                    현재 플랜
                  </span>
                )}

                <h3 className="mb-1 text-lg font-bold text-white">
                  {config.name}
                </h3>
                <p className="mb-4 text-2xl font-bold text-white">
                  {formatPrice(config.price)}
                  <span className="text-sm font-normal text-gray-400">
                    /월
                  </span>
                </p>

                <ul className="mb-6 flex-1 space-y-2">
                  {config.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-gray-300"
                    >
                      <Check size={14} className="shrink-0 text-[#C9A84C]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-lg bg-gray-600/40 py-2.5 text-sm font-semibold text-gray-400"
                  >
                    현재 플랜
                  </button>
                ) : (
                  <button className="w-full rounded-lg bg-[#C9A84C] py-2.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors">
                    업그레이드
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
