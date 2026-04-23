import { useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Printer, FileSpreadsheet, Monitor } from 'lucide-react';
import DocumentCanvas from '@/components/docgen/DocumentCanvas';
import DocumentRenderer from '@/components/docgen/DocumentRenderer';
import DocDownloadButton from '@/components/documents/DocDownloadButton';
import { useDocGenerator } from '@/hooks/useDocGenerator';
import { useCurrentClient } from '@/hooks/useCurrentClient';
import { buildDocTemplate, docgenToBackendType } from '@/data/docTemplates';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';
import { generateCreditorCsv, generateAssetCsv, downloadCsv } from '@/utils/ecfsCsv';
import type { DocType } from '@/types/docgen';
import type { SourceItem } from '@/components/docgen/SourceBadge';
import type { Client } from '@/types/client';

const VALID_TYPES: DocType[] = ['application', 'debt-list', 'asset-list', 'income-list', 'repay-plan'];

export default function DocGeneratePage() {
  const { docType } = useParams<{ docType: string }>();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const location = useLocation();
  const navigate = useNavigate();

  const hubPath = location.pathname.startsWith('/docs-gen') ? '/docs-gen' : '/my/docs';
  const backLink = clientId ? `${hubPath}?clientId=${clientId}` : hubPath;

  // B2B/B2C 어댑터 — officeId·clientId 없고 B2C 인증도 없으면 비활성 → data=null → 데모 fallback
  const clientQuery = useCurrentClient(clientId ?? undefined);
  const client: Client | null = clientQuery.data ?? null;

  const isValid = docType && VALID_TYPES.includes(docType as DocType);
  const template = useMemo(() => {
    if (!isValid) return null;
    return buildDocTemplate(docType as DocType, client);
  }, [docType, isValid, client]);

  if (!isValid || !template) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">알 수 없는 서류입니다.</p>
        <Link to={hubPath} className="text-brand-gold hover:underline">← 서류 목록으로</Link>
      </div>
    );
  }

  return (
    <DocGenerateInner
      template={template}
      client={client}
      onBack={() => navigate(backLink)}
    />
  );
}

interface InnerProps {
  template: ReturnType<typeof buildDocTemplate>;
  client: Client | null;
  onBack: () => void;
}

function DocGenerateInner({ template, client, onBack }: InnerProps) {
  const navigate = useNavigate();
  const gen = useDocGenerator({ template });

  // 템플릿 바뀌면 초기화 (서류 종류 변경 or 의뢰인 변경)
  useEffect(() => {
    gen.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.type, client?.id]);

  // 완료 시 진행률 저장
  useEffect(() => {
    if (gen.status === 'done') {
      saveProgress(client?.id ?? 'demo', template.type, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status]);

  const sources: SourceItem[] = template.requiredSources.map((id) => {
    const meta = SOURCE_CATALOG[id];
    return {
      id,
      label: meta?.label ?? id,
      icon: meta?.icon,
      status: gen.sourceStatus[id] ?? 'pending',
    };
  });

  const canvasState = gen.status === 'connecting' ? 'generating' : gen.status === 'error' ? 'idle' : gen.status;
  const backendDocType = docgenToBackendType(template.type);
  const canDownload = !!client && client.id !== 'demo';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -m-6">
      {/* 상단 내비게이션 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          ← 서류 선택
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{template.icon}</span>
          <span>{template.title}</span>
          {client && <span className="text-gray-600">· {client.name}</span>}
        </div>
        <div className="ml-auto flex gap-2 text-xs text-gray-500">
          {gen.status === 'generating' && (
            <button onClick={gen.skipToEnd} className="px-3 py-1 hover:bg-gray-100 rounded">
              건너뛰기 ⏭
            </button>
          )}
          <button onClick={gen.reset} className="px-3 py-1 hover:bg-gray-100 rounded">
            다시 만들기
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-hidden bg-gray-50 p-6">
        <DocumentCanvas
          title={template.title}
          subtitle={template.subtitle}
          sources={sources}
          state={canvasState}
          progress={gen.progress}
          onStart={gen.start}
          onPause={gen.pause}
          onResume={gen.resume}
          onEditToggle={gen.toggleEdit}
        >
          <DocumentRenderer
            template={template}
            pointer={gen.pointer}
            status={gen.status}
            onFieldComplete={gen.advanceField}
          />
        </DocumentCanvas>
      </div>

      {/* 완료 액션 바 */}
      {gen.status === 'done' && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-emerald-700 mr-2">✓ 서류가 준비됐습니다</span>

          {canDownload && client ? (
            <>
              <DocDownloadButton client={client} docType={backendDocType} format="docx" label="DOCX 다운로드" />
              <DocDownloadButton client={client} docType={backendDocType} format="hwpx" label="HWPX 다운로드" />
              <DocDownloadButton client={client} docType="all" format="docx" label="전체 5종 ZIP (DOCX)" />

              {template.type === 'debt-list' && (
                <button
                  onClick={() => {
                    const csv = generateCreditorCsv(client.debts);
                    downloadCsv(csv, `채권자목록_${client.name}.csv`);
                  }}
                  disabled={client.debts.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  전자소송 채권자 CSV
                </button>
              )}
              {template.type === 'asset-list' && (
                <button
                  onClick={() => {
                    const csv = generateAssetCsv(client.assets);
                    downloadCsv(csv, `재산목록_${client.name}.csv`);
                  }}
                  disabled={client.assets.length === 0}
                  className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <FileSpreadsheet size={16} />
                  전자소송 재산 CSV
                </button>
              )}

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Printer size={16} />
                인쇄
              </button>
              <button
                onClick={() => navigate(`/ecfs-helper?clientId=${client.id}`)}
                className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2d42]"
              >
                <Monitor size={16} />
                전자소송 제출
              </button>
            </>
          ) : (
            <span className="text-sm text-amber-700">
              데모 모드에서는 다운로드가 비활성화됩니다. 의뢰인을 선택하면 실제 DOCX/HWPX가 생성됩니다.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function saveProgress(bucket: string, type: string, pct: number) {
  if (typeof window === 'undefined') return;
  try {
    const key = `docgen-progress:${bucket}`;
    const raw = window.localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[type] = pct;
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
