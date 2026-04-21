import { useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DocumentCanvas from '@/components/docgen/DocumentCanvas';
import DocumentRenderer from '@/components/docgen/DocumentRenderer';
import { useDocGenerator } from '@/hooks/useDocGenerator';
import { getDocTemplate } from '@/data/docTemplates';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';
import type { DocType } from '@/types/docgen';
import type { SourceItem } from '@/components/docgen/SourceBadge';

const VALID_TYPES: DocType[] = ['application', 'debt-list', 'asset-list', 'income-list', 'repay-plan'];

export default function DocGeneratePage() {
  const { docType } = useParams<{ docType: string }>();
  const navigate = useNavigate();

  const template = useMemo(() => {
    if (!docType || !VALID_TYPES.includes(docType as DocType)) return null;
    return getDocTemplate(docType as DocType);
  }, [docType]);

  if (!template) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">알 수 없는 서류입니다.</p>
        <Link to="/my/docs" className="text-brand-gold hover:underline">← 서류 목록으로</Link>
      </div>
    );
  }

  return <DocGenerateInner template={template} onBack={() => navigate('/my/docs')} />;
}

function DocGenerateInner({ template, onBack }: { template: ReturnType<typeof getDocTemplate>; onBack: () => void }) {
  const gen = useDocGenerator({ template });

  // 템플릿 바뀌면 초기화
  useEffect(() => {
    gen.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.type]);

  // 출처 칩 데이터 (동적 상태)
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
        </div>
        <div className="ml-auto flex gap-2 text-xs text-gray-500">
          {gen.status === 'generating' && (
            <button
              onClick={gen.skipToEnd}
              className="px-3 py-1 hover:bg-gray-100 rounded"
            >
              건너뛰기 ⏭
            </button>
          )}
          <button
            onClick={gen.reset}
            className="px-3 py-1 hover:bg-gray-100 rounded"
          >
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
          onDownload={() => alert('다운로드 기능은 다음 단계에서 구현됩니다. (PDF/DOCX/HWPX)')}
        >
          <DocumentRenderer
            template={template}
            pointer={gen.pointer}
            status={gen.status}
            onFieldComplete={gen.advanceField}
          />
        </DocumentCanvas>
      </div>
    </div>
  );
}
