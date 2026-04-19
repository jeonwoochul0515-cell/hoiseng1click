import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Printer, Users, Monitor, FileSpreadsheet } from 'lucide-react';
import type { Client } from '@/types/client';
import type { DocType } from '@/types/document';
import { useClients } from '@/hooks/useClients';
import { useAuthStore } from '@/store/authStore';
import { formatPhone, formatKRW } from '@/utils/formatter';
import DocSelector from '@/components/documents/DocSelector';
import DocPreview from '@/components/documents/DocPreview';
import DocDownloadButton from '@/components/documents/DocDownloadButton';
import { generateCreditorCsv, generateAssetCsv, downloadCsv } from '@/utils/ecfsCsv';


export default function DocumentsPage() {
  const { data: clients, isLoading } = useClients();
  const { office } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>('debt_list');

  // URL 파라미터에서 clientId를 읽어 초기 의뢰인 자동 선택
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId) {
      setSelectedClientId(clientId);
    }
  }, [searchParams]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.trim().toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [clients, searchQuery]);

  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? null;
  const totalDebt = (c: Client) => c.debts.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="flex h-full flex-col md:flex-row gap-4">
      {/* Mobile: Client dropdown selector */}
      <div className="md:hidden rounded-xl bg-white border border-gray-200 p-4">
        <label htmlFor="mobile-client-select" className="mb-2 block text-sm font-semibold text-gray-900">의뢰인 선택</label>
        <select
          id="mobile-client-select"
          value={selectedClientId ?? ''}
          onChange={e => setSelectedClientId(e.target.value || null)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 px-3 text-sm text-gray-900 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
        >
          <option value="">-- 의뢰인을 선택하세요 --</option>
          {(clients ?? []).map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({formatPhone(c.phone)})
            </option>
          ))}
        </select>
      </div>

      {/* Left Panel - Client List (desktop only) */}
      <div className="hidden md:flex md:w-[300px] md:shrink-0 flex-col rounded-xl bg-white border border-gray-200">
        <div className="border-b border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">의뢰인 선택</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="이름 또는 연락처 검색"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Users size={24} className="mb-2" />
              <p className="text-xs">의뢰인이 없습니다</p>
            </div>
          ) : (
            filteredClients.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedClientId === c.id
                    ? 'bg-brand-gold/15 text-brand-gold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  {c.debts.length > 0 && (
                    <span className="text-[10px] text-gray-400">{formatKRW(totalDebt(c))}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-400">{formatPhone(c.phone)}</span>
                  <span className="text-[10px] text-gray-400">
                    채무{c.debts.length} · 재산{c.assets.length}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Doc Type Selector */}
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <DocSelector selected={selectedDocType} onSelect={setSelectedDocType} />
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-white border border-gray-200 p-4">
          {!selectedClient ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <Users size={32} className="mb-3" />
              <p className="text-sm">좌측에서 의뢰인을 선택해주세요</p>
            </div>
          ) : !selectedDocType ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <p className="text-sm">서류 유형을 선택해주세요</p>
            </div>
          ) : (
            <DocPreview docType={selectedDocType} clientData={selectedClient} office={office} />
          )}
        </div>

        {/* Download Buttons */}
        <div className="flex flex-wrap gap-2 rounded-xl bg-white border border-gray-200 p-4">
          {selectedClient && selectedDocType ? (
            <>
              <DocDownloadButton client={selectedClient} docType={selectedDocType} format="docx" label="DOCX 다운로드" />
              <DocDownloadButton client={selectedClient} docType={selectedDocType} format="hwpx" label="HWPX 다운로드" />
              <DocDownloadButton client={selectedClient} docType="all" format="docx" label="전체 6종 ZIP (DOCX)" />
              <DocDownloadButton client={selectedClient} docType="all" format="hwpx" label="전체 6종 ZIP (HWPX)" />
              <button
                onClick={() => {
                  const csv = generateCreditorCsv(selectedClient.debts);
                  downloadCsv(csv, `채권자목록_${selectedClient.name}.csv`);
                }}
                disabled={selectedClient.debts.length === 0}
                className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={16} />
                전자소송 CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Printer size={16} />
                인쇄
              </button>
              <button
                onClick={() => navigate(`/ecfs-helper?clientId=${selectedClient.id}`)}
                className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a2d42] transition-colors"
              >
                <Monitor size={16} />
                전자소송 제출
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">의뢰인과 서류 유형을 선택하면 다운로드할 수 있습니다.</p>
          )}
        </div>
      </div>

    </div>
  );
}
