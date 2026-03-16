import { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle, Loader2, X } from 'lucide-react';
import { ocrIdCard, ocrBankbook, type IdCardData, type BankbookData } from '@/utils/ocr';

export type OcrDocType = 'idCard' | 'bankbook';

interface OcrScannerProps {
  docType: OcrDocType;
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: IdCardData | BankbookData) => void;
}

const DOC_LABELS: Record<OcrDocType, { title: string; description: string }> = {
  idCard: {
    title: '주민등록증 스캔',
    description: '주민등록증 앞면을 촬영하거나 이미지를 업로드하세요.',
  },
  bankbook: {
    title: '통장 사본 스캔',
    description: '통장 표지를 촬영하거나 이미지를 업로드하세요.',
  },
};

export function OcrScanner({ docType, isOpen, onClose, onResult }: OcrScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IdCardData | BankbookData | null>(null);

  const label = DOC_LABELS[docType];

  const reset = () => {
    setPreviewUrl('');
    setLoading(false);
    setProgress(0);
    setDone(false);
    setError('');
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setError('');
    setProgress(0);
    setDone(false);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);

    try {
      let data: IdCardData | BankbookData;
      if (docType === 'idCard') {
        data = await ocrIdCard(file, setProgress);
      } else {
        data = await ocrBankbook(file, setProgress);
      }
      setResult(data);
      setDone(true);
    } catch {
      setError('이미지를 인식하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirm = () => {
    if (result) {
      onResult(result);
      handleClose();
    }
  };

  // Editable result fields
  const updateResult = (field: string, value: string) => {
    if (!result) return;
    setResult({ ...result, [field]: value });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">{label.title}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{label.description}</p>
            </div>
            <button onClick={handleClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
            )}

            {/* Upload area */}
            {!previewUrl ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 transition-colors"
              >
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">이미지를 업로드하세요</p>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG / 최대 10MB</p>
                <div className="mt-4 flex justify-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black">
                    <Upload size={14} /> 파일 선택
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                    <Camera size={14} /> 카메라
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={previewUrl} alt="스캔 이미지" className="w-full max-h-48 object-contain bg-gray-100" />
                  {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                      <Loader2 className="h-8 w-8 text-[#C9A84C] animate-spin mb-2" />
                      <p className="text-sm text-white">문서 인식 중... {progress}%</p>
                      <div className="mt-2 h-1.5 w-48 rounded-full bg-gray-700">
                        <div className="h-full rounded-full bg-[#C9A84C] transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                  {done && !loading && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-6 w-6 text-emerald-500" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setPreviewUrl(''); setDone(false); setResult(null); setError(''); }}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  다른 이미지 업로드
                </button>
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

            {/* Editable result fields */}
            {done && result && (
              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase">인식 결과 (수정 가능)</p>

                {docType === 'idCard' && (
                  <>
                    <FieldRow label="이름" value={(result as IdCardData).name} onChange={v => updateResult('name', v)} placeholder="홍길동" />
                    <FieldRow label="주민등록번호" value={(result as IdCardData).ssn} onChange={v => updateResult('ssn', v)} placeholder="000000-0000000" />
                    <FieldRow label="주소" value={(result as IdCardData).address} onChange={v => updateResult('address', v)} placeholder="서울특별시 강남구..." />
                  </>
                )}

                {docType === 'bankbook' && (
                  <>
                    <FieldRow label="은행명" value={(result as BankbookData).bankName} onChange={v => updateResult('bankName', v)} placeholder="국민은행" />
                    <FieldRow label="계좌번호" value={(result as BankbookData).accountNumber} onChange={v => updateResult('accountNumber', v)} placeholder="000-0000-0000-00" />
                    <FieldRow label="예금주" value={(result as BankbookData).accountHolder} onChange={v => updateResult('accountHolder', v)} placeholder="홍길동" />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-gray-200 px-5 py-4">
            <button
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!done || !result}
              className="flex-1 rounded-lg bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8973e] transition-colors disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldRow({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
      />
    </div>
  );
}
