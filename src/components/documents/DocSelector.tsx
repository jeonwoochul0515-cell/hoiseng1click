import { FileText, List, DollarSign, ClipboardList, Calculator, ShieldBan } from 'lucide-react';
import type { DocType } from '@/types/document';
import { DOC_LABELS } from '@/types/document';

interface DocSelectorProps {
  selected: DocType | null;
  onSelect: (docType: DocType) => void;
}

const DOC_ICONS: Record<DocType, typeof FileText> = {
  debt_list: List,
  asset_list: ClipboardList,
  income_list: DollarSign,
  application: FileText,
  repay_plan: Calculator,
  statement: FileText,
  prohibition_order: ShieldBan,
};

const docTypes: DocType[] = ['debt_list', 'asset_list', 'income_list', 'application', 'repay_plan', 'statement', 'prohibition_order'];

export default function DocSelector({ selected, onSelect }: DocSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {docTypes.map((dt) => {
        const Icon = DOC_ICONS[dt];
        const isSelected = selected === dt;
        return (
          <button
            key={dt}
            onClick={() => onSelect(dt)}
            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isSelected
                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-500'
            }`}
          >
            <Icon size={16} />
            {DOC_LABELS[dt]}
          </button>
        );
      })}
    </div>
  );
}
