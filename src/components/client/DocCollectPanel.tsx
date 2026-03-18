/**
 * 서류수집 패널 — CODEF 결과 기반 동적 버튼 + 업로드 + OCR
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink, Upload, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Download, RefreshCw, Loader2, FileText,
} from 'lucide-react';
import type { Client } from '@/types/client';
import type { ClientDocument, DocCategory } from '@/types/document';
import { generateDocButtons, type DocButton } from '@/utils/requiredDocs';
import { getDocuments, uploadDocument, requestOcr } from '@/api/documents';
import { formatKRW } from '@/utils/formatter';

interface Props {
  client: Client;
  officeId: string;
}

const CATEGORY_LABELS: Record<DocCategory, { label: string; icon: string }> = {
  basic: { label: '기본서류', icon: '📋' },
  bank: { label: '은행', icon: '🏦' },
  card: { label: '카드', icon: '💳' },
  insurance: { label: '보험', icon: '🛡️' },
  asset: { label: '자산', icon: '🚗' },
  income: { label: '소득', icon: '💰' },
  etc: { label: '기타', icon: '📁' },
};

export default function DocCollectPanel({ client, officeId }: Props) {
  const [buttons, setButtons] = useState<DocButton[]>([]);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // CODEF 수집 결과 기반 버튼 생성
      const hasRealEstate = client.assets?.some(a => a.type === '부동산');
      const btns = generateDocButtons(client.debts || [], client.assets || [], {
        hasRealEstate,
        jobType: client.jobType,
      });

      // 기존 업로드 서류 로드
      const uploaded = await getDocuments(officeId, client.id);

      // 업로드된 서류와 버튼 매칭
      for (const btn of btns) {
        const match = uploaded.find(d =>
          d.institution === btn.institution && d.docType === btn.docType
        );
        if (match) {
          btn.status = match.ocrStatus === 'done' ? 'verified' : 'uploaded';
        }
      }

      setButtons(btns);
      setDocs(uploaded);
    } catch (err) {
      console.error('서류 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [client, officeId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (btn: DocButton, file: File) => {
    setUploading(btn.id);
    try {
      const doc = await uploadDocument(officeId, client.id, file, {
        category: btn.category,
        subCategory: btn.institution,
        institution: btn.institution,
        docType: btn.docType,
        codefAmount: btn.codefData?.amount,
      });

      // OCR 요청
      const ocrDocType = btn.category === 'bank' || btn.category === 'card' ? 'debt_cert'
        : btn.category === 'insurance' ? 'surrender_value'
        : btn.docType.includes('소득') ? 'income_cert'
        : btn.docType.includes('납세') ? 'tax_cert'
        : 'general';

      requestOcr(officeId, client.id, doc.id, doc.storagePath, ocrDocType).catch(() => {});

      // 상태 업데이트
      setButtons(prev => prev.map(b => b.id === btn.id ? { ...b, status: 'uploaded' } : b));
      setDocs(prev => [...prev, doc]);
    } catch (err) {
      console.error('업로드 실패:', err);
      alert('업로드에 실패했습니다.');
    } finally {
      setUploading(null);
    }
  };

  // 카테고리별 그룹핑
  const categories = Array.from(new Set(buttons.map(b => b.category)));
  const grouped = categories.map(cat => ({
    category: cat,
    ...CATEGORY_LABELS[cat],
    items: buttons.filter(b => b.category === cat),
    uploaded: buttons.filter(b => b.category === cat && (b.status === 'uploaded' || b.status === 'verified')).length,
    total: buttons.filter(b => b.category === cat).length,
  }));

  const totalUploaded = buttons.filter(b => b.status === 'uploaded' || b.status === 'verified' || b.status === 'auto').length;
  const totalCount = buttons.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 전체 진행률 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">서류 수집 현황</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">{totalUploaded}/{totalCount}</span>
            <button onClick={loadData} className="text-xs text-blue-600 hover:text-blue-800">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (totalUploaded / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 카테고리별 */}
      {grouped.map(group => (
        <div key={group.category} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* 카테고리 헤더 */}
          <button
            onClick={() => setExpanded(expanded === group.category ? null : group.category)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{group.icon}</span>
              <span className="font-semibold text-gray-900">{group.label}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {group.uploaded}/{group.total}
              </span>
            </div>
            {expanded === group.category ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* 항목 목록 */}
          {expanded === group.category && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {group.items.map(btn => {
                const uploadedDoc = docs.find(d => d.institution === btn.institution && d.docType === btn.docType);
                const isUploading = uploading === btn.id;

                return (
                  <div key={btn.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* 상태 아이콘 */}
                      {btn.status === 'verified' ? <CheckCircle size={18} className="text-green-500 shrink-0" />
                        : btn.status === 'uploaded' ? <CheckCircle size={18} className="text-blue-400 shrink-0" />
                        : btn.status === 'auto' ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                        : <Clock size={18} className="text-gray-300 shrink-0" />}

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{btn.institution}</span>
                          <span className="text-xs text-gray-500">{btn.docType}</span>
                        </div>
                        {btn.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{btn.description}</p>
                        )}
                        {/* CODEF 금액 */}
                        {btn.codefData && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            CODEF: {formatKRW(btn.codefData.amount)}
                          </p>
                        )}
                        {/* OCR 결과 + 불일치 경고 */}
                        {uploadedDoc?.pdfAmount && (
                          <p className="text-xs text-green-600 mt-0.5">
                            PDF: {formatKRW(uploadedDoc.pdfAmount)}
                            {uploadedDoc.dataMismatch && btn.codefData && (
                              <span className="text-red-500 ml-1">
                                <AlertTriangle size={10} className="inline" /> CODEF 대비 {formatKRW(uploadedDoc.pdfAmount - btn.codefData.amount)}
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* 버튼들 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 발급 바로가기 */}
                        {btn.url && btn.status !== 'auto' && (
                          <a href={btn.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
                            <ExternalLink size={10} /> 발급
                          </a>
                        )}

                        {/* 업로드 */}
                        {btn.status !== 'auto' && (
                          <label className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white cursor-pointer ${
                            isUploading ? 'bg-gray-400' : uploadedDoc ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
                          }`}>
                            {isUploading ? <Loader2 size={10} className="animate-spin" />
                              : uploadedDoc ? <CheckCircle size={10} />
                              : <Upload size={10} />}
                            {isUploading ? '...' : uploadedDoc ? '재업로드' : '업로드'}
                            <input type="file" accept="image/*,.pdf,.hwp,.hwpx,.doc,.docx" className="hidden"
                              disabled={isUploading}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(btn, f); }} />
                          </label>
                        )}

                        {/* 다운로드 (업로드된 경우) */}
                        {uploadedDoc && (
                          <a href={uploadedDoc.downloadUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-blue-500 px-2 py-1.5 text-xs text-white hover:bg-blue-600">
                            <Download size={10} />
                          </a>
                        )}

                        {/* 자동수집 완료 */}
                        {btn.status === 'auto' && (
                          <span className="text-xs text-emerald-500 font-medium">자동수집 ✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
