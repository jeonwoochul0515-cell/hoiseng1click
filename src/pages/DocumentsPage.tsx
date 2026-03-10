import { useState, useMemo } from 'react';
import { Search, Printer } from 'lucide-react';
import type { Client } from '@/types/client';
import type { DocType } from '@/types/document';
import DocSelector from '@/components/documents/DocSelector';
import DocPreview from '@/components/documents/DocPreview';
import DocDownloadButton from '@/components/documents/DocDownloadButton';
import UpgradeModal from '@/components/subscription/UpgradeModal';

// ----- Mock clients -----
const mockClients: Client[] = [
  {
    id: '1', name: '김영수', ssn: '900101-1234567', phone: '01012345678',
    address: '서울특별시 강남구 테헤란로 123', job: '회사원', jobType: 'employed',
    family: 3, court: '서울회생법원', income: 3200000, income2: 0,
    rent: 500000, education: 200000, medical: 100000,
    status: 'drafting', collectionDone: true,
    debts: [
      { id: '1', creditor: '국민은행', name: '신용대출', type: '무담보', amount: 35000000, rate: 5.5, monthly: 580000, source: 'codef' },
      { id: '2', creditor: '신한카드', name: '카드론', type: '무담보', amount: 12000000, rate: 12.0, monthly: 320000, source: 'codef' },
      { id: '3', creditor: '하나은행', name: '주택담보대출', type: '담보', amount: 80000000, rate: 3.8, monthly: 450000, source: 'codef' },
    ],
    assets: [
      { id: '1', name: '아파트', type: '부동산', rawValue: 350000000, liquidationRate: 0.7, mortgage: 200000000, value: 45000000, source: 'api' },
      { id: '2', name: '현대 아반떼', type: '차량', rawValue: 15000000, liquidationRate: 0.6, mortgage: 0, value: 9000000, source: 'api' },
    ],
    memo: '', createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-03-09'),
  },
  {
    id: '2', name: '이미영', ssn: '850312-2345678', phone: '01098765432',
    address: '서울특별시 서초구 반포대로 45', job: '자영업', jobType: 'self',
    family: 4, court: '서울회생법원', income: 2800000, income2: 500000,
    rent: 600000, education: 300000, medical: 150000,
    status: 'collecting', collectionDone: false,
    debts: [
      { id: '4', creditor: '우리은행', name: '사업자대출', type: '무담보', amount: 50000000, rate: 6.2, monthly: 700000, source: 'codef' },
      { id: '5', creditor: 'KB국민카드', name: '카드대금', type: '무담보', amount: 8000000, rate: 15.0, monthly: 250000, source: 'codef' },
    ],
    assets: [
      { id: '3', name: '기아 K5', type: '차량', rawValue: 20000000, liquidationRate: 0.6, mortgage: 0, value: 12000000, source: 'api' },
    ],
    memo: '', createdAt: new Date('2026-02-03'), updatedAt: new Date('2026-03-08'),
  },
  {
    id: '3', name: '박준혁', ssn: '920715-1456789', phone: '01055556666',
    address: '경기도 수원시 영통구 광교로 88', job: '프리랜서', jobType: 'freelance',
    family: 1, court: '수원지방법원', income: 2500000, income2: 800000,
    rent: 450000, education: 0, medical: 50000,
    status: 'new', collectionDone: false,
    debts: [
      { id: '6', creditor: '토스뱅크', name: '신용대출', type: '무담보', amount: 25000000, rate: 8.5, monthly: 400000, source: 'manual' },
    ],
    assets: [],
    memo: '', createdAt: new Date('2026-03-08'), updatedAt: new Date('2026-03-08'),
  },
];

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>('debt_list');

  const filteredClients = useMemo(
    () => mockClients.filter((c) => c.name.includes(searchQuery) || c.phone.includes(searchQuery)),
    [searchQuery],
  );

  const selectedClient = mockClients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Client List */}
      <div className="flex w-[300px] shrink-0 flex-col rounded-xl bg-[#111827]">
        <div className="border-b border-gray-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">의뢰인 선택</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 연락처 검색"
              className="w-full rounded-lg bg-[#0D1B2A] py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredClients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                selectedClientId === c.id
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.phone}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Doc Type Selector */}
        <div className="rounded-xl bg-[#111827] p-4">
          <DocSelector selected={selectedDocType} onSelect={setSelectedDocType} />
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-gray-900 p-4">
          {selectedDocType ? (
            <DocPreview docType={selectedDocType} clientData={selectedClient} />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              서류 유형을 선택해주세요
            </div>
          )}
        </div>

        {/* Download Buttons */}
        <div className="flex flex-wrap gap-2 rounded-xl bg-[#111827] p-4">
          {selectedClient && selectedDocType ? (
            <>
              <DocDownloadButton
                client={selectedClient}
                docType={selectedDocType}
                format="docx"
                label="DOCX 다운로드"
              />
              <DocDownloadButton
                client={selectedClient}
                docType={selectedDocType}
                format="hwpx"
                label="HWPX 다운로드"
              />
              <DocDownloadButton
                client={selectedClient}
                docType="all"
                format="docx"
                label="전체 5종 ZIP (DOCX)"
              />
              <DocDownloadButton
                client={selectedClient}
                docType="all"
                format="hwpx"
                label="전체 5종 ZIP (HWPX)"
              />
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-gray-600 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
              >
                <Printer size={16} />
                인쇄
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">의뢰인과 서류 유형을 선택하면 다운로드할 수 있습니다.</p>
          )}
        </div>
      </div>

      {/* Upgrade Modal (rendered globally) */}
      <UpgradeModal />
    </div>
  );
}
