import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';
import {
  ExternalLink, CheckCircle, Circle, Upload, FileText, Loader2,
  ChevronDown, ChevronUp, Clock, AlertCircle, Building2, CreditCard, Shield, Landmark,
} from 'lucide-react';
import { getRequiredCerts, PUBLIC_CERTS, type BankCertInfo } from '@/utils/bankDirectory';
import { verifyIntakePin, type IntakeToken } from '@/api/intake';

type SubmitStatus = 'pending' | 'uploading' | 'uploaded' | 'skipped';

interface CertItem extends BankCertInfo {
  status: SubmitStatus;
  fileName?: string;
  downloadUrl?: string;
}

export default function DocumentSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<'pin' | 'list'>('pin');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [tokenData, setTokenData] = useState<IntakeToken | null>(null);
  const [certs, setCerts] = useState<CertItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // PIN 인증 후 의뢰인 채무 데이터 로드
  const handlePinSubmit = async () => {
    const pin = pinDigits.join('');
    if (pin.length !== 4 || !token) return;
    setLoading(true);
    setPinError('');

    try {
      const result = await verifyIntakePin(token, pin);
      if (result.ok) {
        setTokenData(result.token);
        // 의뢰인 데이터 로드
        await loadClientCerts(result.token.officeId);
        setStep('list');
      } else {
        const msgs: Record<string, string> = {
          not_found: '유효하지 않은 링크입니다.',
          expired: '만료된 링크입니다.',
          wrong_pin: '비밀번호가 올바르지 않습니다.',
          used: '이미 사용된 링크입니다. 계속 이용 가능합니다.',
        };
        if (result.reason === 'used') {
          // used여도 서류 제출은 허용
          const tk = await import('@/api/intake').then(m => m.getIntakeToken(token!));
          if (tk) {
            setTokenData(tk);
            await loadClientCerts(tk.officeId);
            setStep('list');
          }
        } else {
          setPinError(msgs[result.reason] || '인증에 실패했습니다.');
        }
      }
    } catch {
      setPinError('인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadClientCerts = async (officeId: string) => {
    try {
      // intakeSubmissions에서 의뢰인 데이터 조회
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const q = query(
        collection(db, 'intakeSubmissions'),
        where('tokenId', '==', token),
      );
      const snap = await getDocs(q);

      let creditors: string[] = [];
      if (!snap.empty) {
        const data = snap.docs[0].data();
        creditors = (data.debts ?? []).map((d: any) => d.creditor).filter(Boolean);
      }

      // 의뢰인이 clients로 변환된 경우도 체크 (tokenId 매칭)
      if (creditors.length === 0 && !snap.empty) {
        const submissionId = snap.docs[0].id;
        const clientsQ = query(
          collection(db, 'offices', officeId, 'clients'),
          where('intakeSubmissionId', '==', submissionId),
        );
        const clientsSnap = await getDocs(clientsQ);
        if (!clientsSnap.empty) {
          const client = clientsSnap.docs[0].data();
          creditors = (client.debts ?? []).map((debt: any) => debt.creditor).filter(Boolean);
        }
      }

      const required = getRequiredCerts(creditors);
      setCerts(required.map(c => ({ ...c, status: 'pending' })));
    } catch (err) {
      console.error('서류 목록 로드 실패:', err);
      // 기본 공공서류만 표시
      setCerts(PUBLIC_CERTS.map(c => ({ ...c, status: 'pending' })));
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...pinDigits];
    next[index] = value;
    setPinDigits(next);
    if (value && index < 3) {
      const nextInput = document.getElementById(`doc-pin-${index + 1}`);
      nextInput?.focus();
    }
    // 4자리 완성 시 자동 제출 (완성된 배열 직접 사용)
    if (index === 3 && value && next.every(d => d)) {
      const pin = next.join('');
      if (pin.length === 4) {
        setLoading(true);
        setPinError('');
        verifyIntakePin(token!, pin).then(async result => {
          if (result.ok) {
            setTokenData(result.token);
            await loadClientCerts(result.token.officeId);
            setStep('list');
          } else if (result.reason === 'used') {
            const tk = await import('@/api/intake').then(m => m.getIntakeToken(token!));
            if (tk) { setTokenData(tk); await loadClientCerts(tk.officeId); setStep('list'); }
          } else {
            const msgs: Record<string, string> = { not_found: '유효하지 않은 링크입니다.', expired: '만료된 링크입니다.', wrong_pin: '비밀번호가 올바르지 않습니다.' };
            setPinError(msgs[result.reason] || '인증에 실패했습니다.');
          }
        }).catch(() => setPinError('인증 중 오류가 발생했습니다.')).finally(() => setLoading(false));
      }
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    const cert = certs[index];
    if (!cert || !tokenData) return;

    // 업로딩 상태
    setCerts(prev => prev.map((c, i) =>
      i === index ? { ...c, status: 'uploading' as SubmitStatus, fileName: file.name } : c
    ));

    try {
      // Storage 경로: docs/{officeId}/{tokenId}/{기관명}_{파일명}
      const safeName = cert.name.replace(/[^가-힣a-zA-Z0-9]/g, '_');
      const ext = file.name.split('.').pop() || 'pdf';
      const storagePath = `docs/${tokenData.officeId}/${token}/${safeName}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);

      // 업로드
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          institution: cert.name,
          certType: cert.certName,
          originalName: file.name,
          tokenId: token || '',
        },
      });

      // 다운로드 URL
      const downloadUrl = await getDownloadURL(storageRef);

      // Firestore에 업로드 기록 저장 (intakeSubmissions 또는 별도 컬렉션)
      try {
        const { getDocs, query, collection, where } = await import('firebase/firestore');
        const q = query(collection(db, 'intakeSubmissions'), where('tokenId', '==', token));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            uploadedDocs: arrayUnion({
              institution: cert.name,
              certType: cert.certName,
              fileName: file.name,
              storagePath,
              downloadUrl,
              uploadedAt: new Date().toISOString(),
            }),
          });
        }
      } catch {
        // Firestore 기록 실패해도 파일은 이미 업로드됨
        console.warn('업로드 기록 저장 실패');
      }

      setCerts(prev => prev.map((c, i) =>
        i === index ? { ...c, status: 'uploaded', fileName: file.name, downloadUrl } : c
      ));
    } catch (err) {
      console.error('파일 업로드 실패:', err);
      setCerts(prev => prev.map((c, i) =>
        i === index ? { ...c, status: 'pending', fileName: undefined } : c
      ));
      alert('파일 업로드에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleSkip = (index: number) => {
    setCerts(prev => prev.map((c, i) =>
      i === index ? { ...c, status: 'skipped' } : c
    ));
  };

  const typeIcon = (type: BankCertInfo['type']) => {
    switch (type) {
      case 'bank': return <Building2 size={16} className="text-blue-500" />;
      case 'card': return <CreditCard size={16} className="text-purple-500" />;
      case 'insurance': return <Shield size={16} className="text-green-500" />;
      case 'savings': return <Building2 size={16} className="text-orange-500" />;
      case 'public': return <Landmark size={16} className="text-gray-500" />;
    }
  };

  const typeLabel = (type: BankCertInfo['type']) => {
    switch (type) {
      case 'bank': return '은행';
      case 'card': return '카드';
      case 'insurance': return '보험';
      case 'savings': return '저축은행';
      case 'public': return '공공기관';
    }
  };

  const statusBadge = (status: SubmitStatus) => {
    switch (status) {
      case 'uploading': return <span className="flex items-center gap-1 text-xs font-medium text-blue-500"><Loader2 size={12} className="animate-spin" /> 업로드 중</span>;
      case 'uploaded': return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={12} /> 업로드됨</span>;
      case 'skipped': return <span className="flex items-center gap-1 text-xs font-medium text-gray-400">건너뜀</span>;
      default: return <span className="flex items-center gap-1 text-xs font-medium text-amber-500"><Clock size={12} /> 미제출</span>;
    }
  };

  const uploaded = certs.filter(c => c.status === 'uploaded').length;
  const total = certs.length;

  // ── PIN 입력 화면 ──
  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-amber-500 mb-3" />
            <h1 className="text-xl font-bold text-gray-900">서류 제출</h1>
            <p className="text-sm text-gray-500 mt-1">비밀번호 4자리를 입력해주세요</p>
          </div>

          <div className="flex justify-center gap-3">
            {pinDigits.map((d, i) => (
              <input
                key={i}
                id={`doc-pin-${i}`}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handlePinChange(i, e.target.value)}
                className="h-14 w-14 rounded-xl border-2 border-gray-300 bg-white text-center text-2xl font-bold text-gray-900 focus:border-amber-400 focus:outline-none"
              />
            ))}
          </div>

          {pinError && (
            <div className="flex items-center gap-2 justify-center text-sm text-red-500">
              <AlertCircle size={14} /> {pinError}
            </div>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-400 border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 서류 목록 화면 ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">서류 제출</h1>
        <p className="text-sm text-gray-500">{tokenData?.officeName}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${total > 0 ? (uploaded / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500">{uploaded}/{total}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-4">
          <p className="text-sm text-blue-800 font-medium">아래 기관별로 부채증명서를 발급받아 업로드해주세요.</p>
          <p className="text-xs text-blue-600 mt-1">
            각 기관명을 누르면 발급 방법과 바로가기 링크를 확인할 수 있습니다.
          </p>
        </div>

        {/* 금융기관 서류 */}
        <div className="space-y-2">
          {certs.map((cert, i) => (
            <div key={i} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                {cert.status === 'uploaded'
                  ? <CheckCircle size={20} className="text-green-500 shrink-0" />
                  : <Circle size={20} className="text-gray-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {typeIcon(cert.type)}
                    <span className="text-sm font-semibold text-gray-900 truncate">{cert.name}</span>
                    <span className="text-[10px] text-gray-400">{typeLabel(cert.type)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cert.certName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(cert.status)}
                  {expanded === i ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded Detail */}
              {expanded === i && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
                  {/* 발급 방법 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-700">발급 경로</p>
                    <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">{cert.path}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">발급방법:</span>{' '}
                      <span className="text-gray-700 font-medium">
                        {cert.method === 'online' ? '인터넷' : cert.method === 'app' ? '앱 전용' : cert.method === 'visit' ? '방문' : '인터넷+앱'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">인증:</span>{' '}
                      <span className="text-gray-700 font-medium">{cert.auth}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">수수료:</span>{' '}
                      <span className="text-gray-700 font-medium">{cert.fee}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">이용시간:</span>{' '}
                      <span className="text-gray-700 font-medium">{cert.hours}</span>
                    </div>
                  </div>

                  {cert.note && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      {cert.note}
                    </p>
                  )}

                  {/* 바로가기 + 업로드 */}
                  <div className="flex gap-2">
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0D1B2A] py-2.5 text-xs font-semibold text-white"
                    >
                      <ExternalLink size={12} /> {cert.name} 바로가기
                    </a>
                    <label className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white ${
                      cert.status === 'uploading' ? 'bg-gray-400 cursor-wait' : 'bg-amber-500 cursor-pointer'
                    }`}>
                      {cert.status === 'uploading'
                        ? <><Loader2 size={12} className="animate-spin" /> 업로드 중...</>
                        : <><Upload size={12} /> 파일 업로드</>}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={cert.status === 'uploading'}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(i, f);
                        }}
                      />
                    </label>
                  </div>

                  {cert.fileName && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={12} /> {cert.fileName}
                    </p>
                  )}

                  {cert.status !== 'uploaded' && (
                    <button
                      onClick={() => handleSkip(i)}
                      className="text-xs text-gray-400 underline"
                    >
                      이 서류 건너뛰기 (나중에 제출)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
