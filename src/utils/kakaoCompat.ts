/** 카카오톡 인앱 브라우저 감지 및 호환성 유틸리티 */

export function isKakaoInApp(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('kakaotalk') || ua.includes('kakao');
}

export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('kakaotalk') ||
    ua.includes('naver') ||
    ua.includes('instagram') ||
    ua.includes('fbav') ||
    ua.includes('line/')
  );
}

/**
 * 카카오톡 인앱에서 외부 브라우저로 열기
 * IntakePage(/intake)는 카카오에서 열리는 게 정상이므로 제외
 */
export function initKakaoCompat() {
  if (!isInAppBrowser()) return;

  const path = window.location.pathname;
  // /intake 경로는 카카오에서 열리는 것이 정상
  if (path.startsWith('/intake')) return;

  // 관리자 페이지를 인앱에서 열면 외부 브라우저 안내
  const banner = document.createElement('div');
  banner.id = 'inapp-banner';
  banner.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#FEF3C7;border-bottom:1px solid #F59E0B;padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:13px;color:#92400E;">
      <span>인앱 브라우저에서는 일부 기능이 제한될 수 있습니다.</span>
      <a href="javascript:void(0)" onclick="window.open(window.location.href,'_system')" style="color:#D97706;font-weight:bold;text-decoration:underline;white-space:nowrap;">외부 브라우저로 열기</a>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;padding:2px 8px;font-size:16px;color:#92400E;background:none;border:none;">✕</button>
    </div>
  `;
  document.body.prepend(banner);
}
