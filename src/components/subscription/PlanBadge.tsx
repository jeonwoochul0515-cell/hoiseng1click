import type { PlanType } from '@/types/subscription';

interface PlanBadgeProps {
  plan: PlanType;
}

const badgeStyles: Record<PlanType, string> = {
  starter: 'bg-gray-600/20 text-gray-600',
  pro: 'bg-yellow-600/20 text-[#C9A84C]',
  enterprise: 'bg-purple-600/20 text-purple-400',
};

const badgeLabels: Record<PlanType, string> = {
  starter: 'STARTER',
  pro: 'PRO',
  enterprise: 'ENTERPRISE',
};

export default function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyles[plan]}`}
    >
      {badgeLabels[plan]}
    </span>
  );
}
