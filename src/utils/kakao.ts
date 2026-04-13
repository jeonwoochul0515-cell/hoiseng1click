declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: object) => Promise<void>;
      };
    };
  }
}

import { toast } from '@/utils/toast';

let initialized = false;

function ensureInit(): boolean {
  if (!window.Kakao) {
    console.warn('[Kakao] SDK not loaded');
    return false;
  }
  const key = import.meta.env.VITE_KAKAO_JS_KEY;
  if (!key) {
    console.warn('[Kakao] VITE_KAKAO_JS_KEY not set');
    return false;
  }
  if (!initialized) {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(key);
    }
    initialized = true;
  }
  return window.Kakao.isInitialized();
}

export async function sendKakaoLink({
  officeName,
  clientName,
  intakeLink,
  pin,
}: {
  officeName: string;
  clientName: string;
  intakeLink: string;
  pin: string;
}): Promise<boolean> {
  if (!ensureInit()) {
    // SDK 실패 시 클립보드 복사 폴백
    const msg = `[${officeName}] 개인회생 접수\n\n${clientName}님, 아래 링크를 눌러 접수를 진행해 주세요.\n\n링크: ${intakeLink}\n비밀번호: ${pin}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.warning('카카오톡 SDK를 불러오지 못해 메시지가 클립보드에 복사되었습니다. 카카오톡에 직접 붙여넣기 해주세요.');
    } catch {
      prompt('카카오톡 SDK를 불러오지 못했습니다. 아래 내용을 복사하세요:', msg);
    }
    return false;
  }

  // 카카오 공유 link URL은 등록된 도메인이어야 함
  const prodOrigin = import.meta.env.VITE_KAKAO_DOMAIN || 'https://hoiseng1click.web.app';
  const shareLink = intakeLink.replace(window.location.origin, prodOrigin);

  try {
    await window.Kakao.Share.sendDefault({
      objectType: 'text',
      text: `[${officeName}] 개인회생 접수\n\n${clientName}님, 아래 버튼을 눌러 접수를 진행해 주세요.\n비밀번호: ${pin}`,
      link: {
        mobileWebUrl: shareLink,
        webUrl: shareLink,
      },
      buttons: [
        {
          title: '접수 시작하기',
          link: {
            mobileWebUrl: shareLink,
            webUrl: shareLink,
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('[Kakao] Share.sendDefault failed:', err);
    // 실패 시 클립보드 복사 폴백
    const msg = `[${officeName}] 개인회생 접수\n\n${clientName}님, 아래 링크를 눌러 접수를 진행해 주세요.\n\n링크: ${intakeLink}\n비밀번호: ${pin}`;
    try {
      await navigator.clipboard.writeText(msg);
      toast.warning('카카오톡 전송에 실패했습니다. 메시지가 클립보드에 복사되었습니다. 카카오톡에 직접 붙여넣기 해주세요.');
    } catch {
      prompt('카카오톡 전송에 실패했습니다. 아래 내용을 복사하세요:', msg);
    }
    return false;
  }
}

export function isKakaoAvailable(): boolean {
  return !!window.Kakao && !!import.meta.env.VITE_KAKAO_JS_KEY;
}
