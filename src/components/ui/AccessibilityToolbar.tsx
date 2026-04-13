import { useState, useEffect } from 'react';
import { Type, Sun } from 'lucide-react';

export default function AccessibilityToolbar() {
  const [largeText, setLargeText] = useState(
    () => localStorage.getItem('a11y_large_text') === 'true',
  );
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem('a11y_high_contrast') === 'true',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('large-text', largeText);
    localStorage.setItem('a11y_large_text', String(largeText));
  }, [largeText]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('a11y_high_contrast', String(highContrast));
  }, [highContrast]);

  return (
    <div className="flex items-center gap-1">
      {/* 글자 크기 토글 */}
      <button
        onClick={() => setLargeText((v) => !v)}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
          largeText
            ? 'bg-brand-gold/20 text-brand-gold'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title={largeText ? '기본 글씨 크기' : '큰 글씨 모드'}
        aria-label={largeText ? '기본 글씨 크기로 전환' : '큰 글씨 모드로 전환'}
      >
        <Type size={20} />
      </button>

      {/* 고대비 토글 */}
      <button
        onClick={() => setHighContrast((v) => !v)}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
          highContrast
            ? 'bg-brand-gold/20 text-brand-gold'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title={highContrast ? '기본 대비' : '고대비 모드'}
        aria-label={highContrast ? '기본 대비로 전환' : '고대비 모드로 전환'}
      >
        <Sun size={20} />
      </button>
    </div>
  );
}
