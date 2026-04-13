/**
 * 주소(시도/시군구)를 기반으로 개인회생 관할법원을 자동 매핑
 * 2026년 3월 기준 — 회생법원 5곳 체제
 *
 * 회생법원 (도산 전문법원):
 *   서울회생법원  — 서울
 *   부산회생법원  — 부산, 울산, 경남
 *   대전회생법원  — 대전, 세종, 충남  (2026.3.1 신설)
 *   대구회생법원  — 대구, 경북        (2026.3.1 신설)
 *   광주회생법원  — 광주, 전남, 전북, 제주  (2026.3.1 신설)
 *
 * 지방법원 본원 관할 (회생법원 미설치 지역):
 *   인천지방법원  — 인천
 *   수원지방법원  — 경기 남부
 *   의정부지방법원 — 경기 북부
 *   청주지방법원  — 충북 (대전회생법원 중복관할 가능)
 *   춘천지방법원  — 강원 서부
 *   춘천지방법원 강릉지원 — 강원 동부
 */

// 경기도 북부 → 의정부지방법원 관할 시군구
const UIJEONGBU_AREAS = [
  '의정부', '고양', '파주', '동두천', '양주', '포천', '연천', '가평', '남양주', '구리', '하남',
];

// 강원 동부 → 춘천지방법원 강릉지원 관할
const GANGNEUNG_AREAS = [
  '강릉', '속초', '동해', '삼척', '태백', '양양', '평창', '정선', '영월',
];

// 시도 → 관할법원 매핑 (2026.3 기준)
const SIDO_COURT_MAP: Record<string, string> = {
  // 서울 → 서울회생법원
  '서울특별시': '서울회생법원',
  '서울': '서울회생법원',

  // 부산·울산·경남 → 부산회생법원
  '부산광역시': '부산회생법원',
  '부산': '부산회생법원',
  '울산광역시': '부산회생법원',
  '울산': '부산회생법원',
  '경상남도': '부산회생법원',
  '경남': '부산회생법원',

  // 대구·경북 → 대구회생법원 (2026.3.1 신설)
  '대구광역시': '대구회생법원',
  '대구': '대구회생법원',
  '경상북도': '대구회생법원',
  '경북': '대구회생법원',

  // 대전·세종·충남 → 대전회생법원 (2026.3.1 신설)
  '대전광역시': '대전회생법원',
  '대전': '대전회생법원',
  '세종특별자치시': '대전회생법원',
  '세종': '대전회생법원',
  '충청남도': '대전회생법원',
  '충남': '대전회생법원',

  // 광주·전남·전북·제주 → 광주회생법원 (2026.3.1 신설)
  '광주광역시': '광주회생법원',
  '광주': '광주회생법원',
  '전라남도': '광주회생법원',
  '전남': '광주회생법원',
  '전라북도': '광주회생법원',
  '전북특별자치도': '광주회생법원',
  '전북': '광주회생법원',
  '제주특별자치도': '광주회생법원',
  '제주': '광주회생법원',

  // 인천 → 인천지방법원 (회생법원 미설치)
  '인천광역시': '인천지방법원',
  '인천': '인천지방법원',

  // 충북 → 청주지방법원 (대전회생법원 중복관할 가능)
  '충청북도': '청주지방법원',
  '충북': '청주지방법원',

  // 강원 → 춘천지방법원 (동부는 강릉지원)
  '강원특별자치도': '춘천지방법원',
  '강원도': '춘천지방법원',
  '강원': '춘천지방법원',
};

/**
 * 시도, 시군구 정보로 관할법원 결정
 */
export function getCourtByAddress(sido: string, sigungu: string): string {
  // 경기도: 시군구에 따라 의정부/수원 분기
  if (sido.startsWith('경기')) {
    const isNorth = UIJEONGBU_AREAS.some(area => sigungu.startsWith(area));
    return isNorth ? '의정부지방법원' : '수원지방법원';
  }

  // 강원도: 동부 지역은 강릉지원
  if (sido.includes('강원')) {
    const isEast = GANGNEUNG_AREAS.some(area => sigungu.startsWith(area));
    return isEast ? '춘천지방법원 강릉지원' : '춘천지방법원';
  }

  return SIDO_COURT_MAP[sido] ?? '';
}

/**
 * 도로명주소 문자열에서 관할법원 추정 (sido/sigungu 없을 때 fallback)
 */
export function getCourtByAddressString(address: string): string {
  // 경기도 처리 (SIDO_COURT_MAP에 없으므로 먼저 체크)
  if (address.startsWith('경기') || address.startsWith('경기도')) {
    const isNorth = UIJEONGBU_AREAS.some(area => address.includes(area));
    return isNorth ? '의정부지방법원' : '수원지방법원';
  }

  for (const [key, court] of Object.entries(SIDO_COURT_MAP)) {
    if (address.startsWith(key)) {
      if (key.includes('강원')) {
        const isEast = GANGNEUNG_AREAS.some(area => address.includes(area));
        return isEast ? '춘천지방법원 강릉지원' : '춘천지방법원';
      }
      return court;
    }
  }
  return '';
}
