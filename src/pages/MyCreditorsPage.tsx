// 사무소별 "내 채권자" 관리 페이지
// URL: /settings/my-creditors
// - 목록/검색/정렬
// - 개별 편집·삭제
// - CSV 가져오기 (일괄 추가)
// - CSV 내보내기 (백업/공유)
// - 공유 디렉토리에서 가져오기
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Download, Upload, Edit2, Trash2, Save, X, Star,
  Users, FileSpreadsheet, Plus,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  listMyCreditors, addOrBumpMyCreditor, updateMyCreditor, deleteMyCreditor,
  type MyCreditor,
} from '@/api/myCreditors';
import { listSharedCreditors, type SharedCreditor } from '@/api/sharedCreditors';
import { toast } from '@/utils/toast';
import { downloadCsv } from '@/utils/ecfsCsv';
import { inferPersonalityType } from '@/utils/ecfsCsv';

type SortKey = 'useCount' | 'name' | 'lastUsedAt';

export default function MyCreditorsPage() {
  const navigate = useNavigate();
  const office = useAuthStore((s) => s.office);

  const [items, setItems] = useState<MyCreditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('useCount');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<MyCreditor>>({});
  const [showShared, setShowShared] = useState(false);
  const [sharedList, setSharedList] = useState<SharedCreditor[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);

  useEffect(() => {
    if (!office?.id) return;
    listMyCreditors(office.id)
      .then(setItems)
      .catch((err) => toast.error(err?.message ?? '로드 실패'))
      .finally(() => setLoading(false));
  }, [office?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.address?.toLowerCase().includes(q) ||
            c.phone?.includes(q),
        )
      : items;
    return [...list].sort((a, b) => {
      if (sortKey === 'useCount') return (b.useCount ?? 0) - (a.useCount ?? 0);
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'lastUsedAt') {
        const av = a.lastUsedAt?.getTime() ?? 0;
        const bv = b.lastUsedAt?.getTime() ?? 0;
        return bv - av;
      }
      return 0;
    });
  }, [items, search, sortKey]);

  const openShared = async () => {
    setShowShared(true);
    if (sharedList.length > 0) return;
    setSharedLoading(true);
    try {
      const list = await listSharedCreditors();
      setSharedList(list);
    } catch (err: any) {
      toast.error(err?.message ?? '공유 디렉토리 로드 실패');
    } finally {
      setSharedLoading(false);
    }
  };

  const importFromShared = async (sc: SharedCreditor) => {
    if (!office?.id) return;
    try {
      await addOrBumpMyCreditor(office.id, {
        name: sc.name,
        personalityType: sc.personalityType,
        zipCode: sc.zipCode,
        address: sc.address,
        addressDetail: sc.addressDetail,
        phone: sc.phone,
        mobile: sc.mobile,
        fax: sc.fax,
        email: sc.email,
      });
      toast.success(`"${sc.name}" 내 채권자에 추가됨`);
      const updated = await listMyCreditors(office.id);
      setItems(updated);
    } catch (err: any) {
      toast.error(err?.message ?? '가져오기 실패');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!office?.id) return;
    if (!confirm(`"${name}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteMyCreditor(office.id, id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast.success('삭제 완료');
    } catch (err: any) {
      toast.error(err?.message ?? '삭제 실패');
    }
  };

  const startEdit = (c: MyCreditor) => {
    setEditingId(c.id);
    setEditBuffer({ ...c });
  };

  const saveEdit = async () => {
    if (!office?.id || !editingId) return;
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, useCount: _uc, lastUsedAt: _lu, ...rest } = editBuffer as MyCreditor;
      await updateMyCreditor(office.id, editingId, rest);
      setItems((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...editBuffer } : c)));
      setEditingId(null);
      toast.success('저장 완료');
    } catch (err: any) {
      toast.error(err?.message ?? '저장 실패');
    }
  };

  const exportCsv = () => {
    if (items.length === 0) {
      toast.warning('내보낼 채권자가 없습니다');
      return;
    }
    const header = ['이름', '인격구분', '우편번호', '주소', '상세주소', '전화', '휴대전화', '팩스', '이메일', '사용횟수'];
    const rows = items.map((c) => [
      c.name,
      c.personalityType ?? '',
      c.zipCode ?? '',
      c.address ?? '',
      c.addressDetail ?? '',
      c.phone ?? '',
      c.mobile ?? '',
      c.fax ?? '',
      c.email ?? '',
      c.useCount ?? 0,
    ]);
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `내채권자_백업_${today}.csv`);
    toast.success(`${items.length}건 내보냄`);
  };

  const importCsv = async (file: File) => {
    if (!office?.id) return;
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('유효한 CSV가 아닙니다');

      // 간단한 파싱 (인용구 처리)
      const parseRow = (line: string): string[] => {
        const cells: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (ch === ',' && !inQ) {
            cells.push(cur); cur = '';
          } else {
            cur += ch;
          }
        }
        cells.push(cur);
        return cells;
      };

      const header = parseRow(lines[0]);
      const nameIdx = header.findIndex((h) => /이름|채권자명|name/i.test(h));
      if (nameIdx < 0) throw new Error('CSV 헤더에 "이름" 또는 "채권자명" 컬럼이 필요합니다');

      const colIdx = (keywords: RegExp) => header.findIndex((h) => keywords.test(h));
      const idx = {
        name: nameIdx,
        zipCode: colIdx(/우편번호|zipCode/i),
        address: colIdx(/주소(?!상세)|address(?!Detail)/i),
        addressDetail: colIdx(/상세주소|addressDetail/i),
        phone: colIdx(/^전화|phone$/i),
        mobile: colIdx(/휴대|mobile/i),
        fax: colIdx(/팩스|fax/i),
        email: colIdx(/이메일|email/i),
      };

      let added = 0;
      for (let i = 1; i < lines.length; i++) {
        const cells = parseRow(lines[i]);
        const name = cells[idx.name]?.trim();
        if (!name) continue;
        await addOrBumpMyCreditor(office.id, {
          name,
          personalityType: inferPersonalityType(name),
          zipCode: idx.zipCode >= 0 ? cells[idx.zipCode]?.trim() : undefined,
          address: idx.address >= 0 ? cells[idx.address]?.trim() : undefined,
          addressDetail: idx.addressDetail >= 0 ? cells[idx.addressDetail]?.trim() : undefined,
          phone: idx.phone >= 0 ? cells[idx.phone]?.trim() : undefined,
          mobile: idx.mobile >= 0 ? cells[idx.mobile]?.trim() : undefined,
          fax: idx.fax >= 0 ? cells[idx.fax]?.trim() : undefined,
          email: idx.email >= 0 ? cells[idx.email]?.trim() : undefined,
        });
        added++;
      }
      const updated = await listMyCreditors(office.id);
      setItems(updated);
      toast.success(`${added}건 가져옴`);
    } catch (err: any) {
      toast.error(err?.message ?? 'CSV 가져오기 실패');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate('/settings')}
            className="mb-1 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> 설정
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="text-amber-500" size={22} /> 내 채권자 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            총 {items.length}건 · 자주 쓰는 채권자 템플릿을 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openShared}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            <Users size={14} /> 공유 디렉토리
          </button>
          <label className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 cursor-pointer">
            <Upload size={14} /> CSV 가져오기
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-gray-700 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800"
          >
            <Download size={14} /> CSV 내보내기
          </button>
        </div>
      </header>

      {/* 검색 + 정렬 */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·주소·전화 검색"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-brand-gold outline-none"
        >
          <option value="useCount">사용 횟수 순</option>
          <option value="name">이름 순</option>
          <option value="lastUsedAt">최근 사용 순</option>
        </select>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Star className="mx-auto mb-3 text-gray-300" size={40} />
          <p className="text-sm text-gray-500">
            {search ? '검색 결과가 없습니다' : '저장된 채권자가 없습니다'}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            의뢰인 등록 시 채무 섹션에서 "💾 저장" 버튼으로 추가할 수 있습니다
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editBuffer.name ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, name: e.target.value })} className="text-sm px-2 py-1.5 border rounded" placeholder="이름" />
                    <input value={editBuffer.zipCode ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, zipCode: e.target.value })} className="text-sm px-2 py-1.5 border rounded" placeholder="우편번호" maxLength={5} />
                  </div>
                  <input value={editBuffer.address ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, address: e.target.value })} className="w-full text-sm px-2 py-1.5 border rounded" placeholder="도로명주소" />
                  <input value={editBuffer.addressDetail ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, addressDetail: e.target.value })} className="w-full text-sm px-2 py-1.5 border rounded" placeholder="상세주소" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={editBuffer.phone ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, phone: e.target.value })} className="text-sm px-2 py-1.5 border rounded" placeholder="전화" />
                    <input value={editBuffer.mobile ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, mobile: e.target.value })} className="text-sm px-2 py-1.5 border rounded" placeholder="휴대전화" />
                    <input value={editBuffer.fax ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, fax: e.target.value })} className="text-sm px-2 py-1.5 border rounded" placeholder="팩스" />
                  </div>
                  <input type="email" value={editBuffer.email ?? ''} onChange={(e) => setEditBuffer({ ...editBuffer, email: e.target.value })} className="w-full text-sm px-2 py-1.5 border rounded" placeholder="이메일" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
                      <X size={14} /> 취소
                    </button>
                    <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-gold text-white rounded hover:opacity-90">
                      <Save size={14} /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      {c.personalityType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{c.personalityType}</span>
                      )}
                      {(c.useCount ?? 0) > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">×{c.useCount}회</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                      {(c.address || c.addressDetail) && (
                        <div>
                          📍 {c.zipCode && <span className="text-gray-400">[{c.zipCode}]</span>} {c.address} {c.addressDetail}
                        </div>
                      )}
                      <div className="flex gap-3 flex-wrap">
                        {c.phone && <span>☎ {c.phone}</span>}
                        {c.mobile && <span>📱 {c.mobile}</span>}
                        {c.fax && <span>📠 {c.fax}</span>}
                      </div>
                      {c.email && <div>✉ {c.email}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(c)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(c.id, c.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 공유 디렉토리 모달 */}
      {showShared && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowShared(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={20} /> 공유 채권자 디렉토리
                </h2>
                <p className="text-xs text-gray-500 mt-1">관리자가 큐레이션한 검증된 채권자 목록입니다</p>
              </div>
              <button onClick={() => setShowShared(false)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {sharedLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
                </div>
              ) : sharedList.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  <FileSpreadsheet className="mx-auto mb-3 text-gray-300" size={32} />
                  공유된 채권자가 아직 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {sharedList.map((sc) => {
                    const already = items.some((i) => i.name === sc.name);
                    return (
                      <div key={sc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{sc.name}</span>
                            {sc.verified && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">✓ 검증됨</span>
                            )}
                          </div>
                          {sc.address && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {sc.zipCode && `[${sc.zipCode}] `}{sc.address} {sc.addressDetail}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => importFromShared(sc)}
                          disabled={already}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded ${
                            already
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {already ? '이미 있음' : <><Plus size={12} /> 내 채권자에 추가</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
