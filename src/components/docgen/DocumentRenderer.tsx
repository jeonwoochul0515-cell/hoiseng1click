import { useState, useRef, useEffect } from 'react';
import type { DocField, DocTemplate } from '@/types/docgen';
import TypewriterField from './TypewriterField';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';

interface FieldPointer {
  sectionIdx: number;
  fieldIdx: number;
}

interface DocumentRendererProps {
  template: DocTemplate;
  pointer: FieldPointer;
  status: 'idle' | 'connecting' | 'generating' | 'paused' | 'editing' | 'done' | 'error';
  onFieldComplete: () => void;
  onSourceReveal?: (sourceId: string) => void;
}

export default function DocumentRenderer({
  template,
  pointer,
  status,
  onFieldComplete,
  onSourceReveal,
}: DocumentRendererProps) {
  // 편집 모드에서 값 수정 추적
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const isEditing = status === 'editing';
  const allRevealed = status === 'done' || status === 'editing' || pointer.sectionIdx >= template.sections.length - 1;

  return (
    <div className="space-y-8">
      {template.sections.map((section, sIdx) => {
        const sectionVisible = isEditing || status === 'done' || sIdx <= pointer.sectionIdx;
        if (!sectionVisible) return null;

        return (
          <section key={section.id} className={sIdx === pointer.sectionIdx && status === 'generating' ? 'relative' : ''}>
            {section.title && (
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4">
                {section.title}
              </h3>
            )}
            <div className="space-y-3">
              {section.fields.map((field, fIdx) => {
                const shouldRender = shouldShowField(sIdx, fIdx, pointer, status);
                const isTyping = sIdx === pointer.sectionIdx && fIdx === pointer.fieldIdx && status === 'generating';

                if (!shouldRender) return null;

                return (
                  <FieldView
                    key={field.id}
                    field={field}
                    isTyping={isTyping}
                    isEditing={isEditing}
                    override={overrides[field.id]}
                    onOverride={(v) => setOverrides((o) => ({ ...o, [field.id]: v }))}
                    onComplete={() => {
                      if (field.sourceId) onSourceReveal?.(field.sourceId);
                      onFieldComplete();
                    }}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {!allRevealed && status === 'connecting' && (
        <div className="text-center py-16 text-gray-400 italic">
          API 연결 중... 데이터를 안전하게 불러오고 있습니다
        </div>
      )}
    </div>
  );
}

function shouldShowField(
  sIdx: number,
  fIdx: number,
  pointer: FieldPointer,
  status: string,
): boolean {
  if (status === 'idle' || status === 'connecting') return false;
  if (status === 'done' || status === 'editing') return true;
  // generating / paused
  if (sIdx < pointer.sectionIdx) return true;
  if (sIdx === pointer.sectionIdx && fIdx <= pointer.fieldIdx) return true;
  return false;
}

interface FieldViewProps {
  field: DocField;
  isTyping: boolean;
  isEditing: boolean;
  override?: string;
  onOverride: (v: string) => void;
  onComplete: () => void;
}

function FieldView({ field, isTyping, isEditing, override, onOverride, onComplete }: FieldViewProps) {
  const displayValue = override ?? field.value;
  const isOverridden = override !== undefined && override !== field.value;

  const labelCls = 'inline-block w-24 font-medium text-gray-600 align-top';
  const valueCls = [
    'text-gray-900',
    field.highlight ? 'font-semibold' : '',
    isOverridden ? 'text-amber-700 border-b border-amber-300' : '',
  ].join(' ');

  const indent = field.indent ? `pl-${field.indent * 4}` : '';

  if (field.block) {
    return (
      <div className={`${indent} ${field.highlight ? 'text-xl text-center font-bold my-6' : 'leading-loose whitespace-pre-line'}`}>
        {isTyping ? (
          <TypewriterField text={displayValue} speed={28} onComplete={onComplete} />
        ) : isEditing ? (
          <EditableText value={displayValue} onChange={onOverride} />
        ) : (
          <span className={isOverridden ? 'text-amber-700 border-b border-amber-300' : ''}>{displayValue}</span>
        )}
        {field.sourceId && !isTyping && (
          <SourceInline sourceId={field.sourceId} />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-start ${indent}`}>
      {field.label && <span className={labelCls}>{field.label}:</span>}
      <span className={`flex-1 ${valueCls}`}>
        {isTyping ? (
          <TypewriterField text={displayValue} speed={30} onComplete={onComplete} />
        ) : isEditing ? (
          <EditableText value={displayValue} onChange={onOverride} />
        ) : (
          displayValue
        )}
        {field.sourceId && !isTyping && <SourceInline sourceId={field.sourceId} />}
      </span>
    </div>
  );
}

function SourceInline({ sourceId }: { sourceId: string }) {
  const src = SOURCE_CATALOG[sourceId];
  if (!src) return null;
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 text-[10px] text-gray-400 font-sans"
      title={src.label}
    >
      <span>{src.icon}</span>
    </span>
  );
}

function EditableText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.innerText)}
      className="outline-none focus:bg-amber-50 focus:ring-2 focus:ring-amber-300 rounded px-1 -mx-1"
    >
      {value}
    </span>
  );
}
