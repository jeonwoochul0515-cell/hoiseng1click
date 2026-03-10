import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!officeName.trim()) {
      setError('사무소 이름을 입력해 주세요.');
      return;
    }
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(email, password, officeName.trim());
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left – Brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#0D1B2A] text-white px-12">
        <Scale className="h-16 w-16 text-[#C9A84C] mb-6" />
        <h1 className="text-4xl font-bold text-[#C9A84C] mb-3">LawDocs</h1>
        <p className="text-lg text-gray-300 mb-10">1회 인증으로 법원 서류 완성</p>

        <ul className="space-y-4 text-gray-400 text-sm max-w-xs">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#C9A84C]">&#10003;</span>
            <span>코드에프 1회 인증으로 필요한 서류를 자동 생성</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#C9A84C]">&#10003;</span>
            <span>의뢰인 관리 · 사건 진행 현황 한눈에</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#C9A84C]">&#10003;</span>
            <span>14일 PRO 무료체험 — 카드 등록 없이 시작</span>
          </li>
        </ul>
      </div>

      {/* Right – Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Scale className="h-7 w-7 text-[#C9A84C]" />
            <span className="text-2xl font-bold text-[#0D1B2A]">LawDocs</span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900">로그인</h2>
            <p className="mt-1 text-sm text-gray-500">이메일과 비밀번호를 입력하세요.</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                placeholder="name@office.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8973e] transition-colors disabled:opacity-50"
            >
              {loading ? '처리 중...' : '로그인'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-400">또는</span>
            </div>
          </div>

          {/* Signup */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">무료체험 시작</h3>
            <p className="text-sm text-gray-500">14일 PRO 플랜 무료 — 카드 등록 불필요</p>

            <div>
              <label htmlFor="officeName" className="block text-sm font-medium text-gray-700 mb-1">
                사무소 이름
              </label>
              <input
                id="officeName"
                type="text"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                placeholder="예: 홍길동 법률사무소"
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleSignup}
              className="w-full rounded-lg border-2 border-[#C9A84C] px-4 py-2.5 text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-colors disabled:opacity-50"
            >
              {loading ? '처리 중...' : '무료체험 시작'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
