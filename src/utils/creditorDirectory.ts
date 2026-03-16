/**
 * 주요 금융기관 본사 주소·전화·팩스 디렉토리
 * 채권자목록 작성 시 자동 입력용
 *
 * 키: 채권자명에 포함되는 키워드 (매칭 우선순위: 정확 → 부분)
 */
export interface CreditorInfo {
  name: string;       // 정식 명칭
  address: string;    // 본사 주소
  phone: string;      // 대표 전화
  fax?: string;       // 팩스
}

const DIRECTORY: CreditorInfo[] = [
  // ─── 시중은행 ───
  { name: 'KB국민은행', address: '서울특별시 영등포구 여의도동 36-3', phone: '1588-9999' },
  { name: '신한은행', address: '서울특별시 중구 태평로2가 20', phone: '1577-8000' },
  { name: '하나은행', address: '서울특별시 중구 을지로 35', phone: '1599-1111' },
  { name: '우리은행', address: '서울특별시 중구 소공로 51', phone: '1588-5000' },
  { name: 'NH농협은행', address: '서울특별시 중구 통일로 120', phone: '1661-3000' },
  { name: '농협은행', address: '서울특별시 중구 통일로 120', phone: '1661-3000' },
  { name: 'IBK기업은행', address: '서울특별시 중구 을지로 79', phone: '1566-2566' },
  { name: '기업은행', address: '서울특별시 중구 을지로 79', phone: '1566-2566' },
  { name: 'SC제일은행', address: '서울특별시 종로구 종로 33', phone: '1588-1599' },
  { name: '한국씨티은행', address: '서울특별시 중구 다동길 39', phone: '1588-7000' },
  { name: 'DGB대구은행', address: '대구광역시 수성구 달구벌대로 2310', phone: '1588-5050' },
  { name: '대구은행', address: '대구광역시 수성구 달구벌대로 2310', phone: '1588-5050' },
  { name: 'BNK부산은행', address: '부산광역시 남구 문현금융로 30', phone: '1588-6200' },
  { name: '부산은행', address: '부산광역시 남구 문현금융로 30', phone: '1588-6200' },
  { name: 'BNK경남은행', address: '경상남도 창원시 마산합포구 3·15대로 714', phone: '1588-8585' },
  { name: '경남은행', address: '경상남도 창원시 마산합포구 3·15대로 714', phone: '1588-8585' },
  { name: '광주은행', address: '광주광역시 동구 제봉로 225', phone: '1588-3388' },
  { name: '전북은행', address: '전라북도 전주시 덕진구 백제대로 566', phone: '1588-4477' },
  { name: '제주은행', address: '제주특별자치도 제주시 도남로 74', phone: '1588-0079' },
  { name: 'KDB산업은행', address: '서울특별시 영등포구 은행로 14', phone: '1588-1500' },
  { name: '산업은행', address: '서울특별시 영등포구 은행로 14', phone: '1588-1500' },
  { name: '수협은행', address: '서울특별시 송파구 가락로 160', phone: '1588-1515' },
  { name: 'SBI저축은행', address: '서울특별시 강남구 테헤란로 326', phone: '1566-2210' },
  { name: 'OK저축은행', address: '서울특별시 중구 을지로 170', phone: '1588-2614' },
  { name: '웰컴저축은행', address: '서울특별시 중구 남대문로 117', phone: '1600-2270' },
  { name: '한국투자저축은행', address: '서울특별시 영등포구 여의나루로 60', phone: '1600-3600' },
  { name: '페퍼저축은행', address: '서울특별시 중구 을지로5길 26', phone: '1588-1114' },
  { name: '카카오뱅크', address: '경기도 성남시 분당구 판교역로 231', phone: '1599-3333' },
  { name: '케이뱅크', address: '서울특별시 중구 을지로 60', phone: '1522-1000' },
  { name: '토스뱅크', address: '서울특별시 강남구 테헤란로 142', phone: '1661-7654' },

  // ─── 카드사 ───
  { name: 'KB국민카드', address: '서울특별시 종로구 새문안로 58', phone: '1588-1688' },
  { name: '국민카드', address: '서울특별시 종로구 새문안로 58', phone: '1588-1688' },
  { name: '신한카드', address: '서울특별시 중구 소월로2길 30', phone: '1544-7000' },
  { name: '삼성카드', address: '서울특별시 중구 세종대로 67', phone: '1588-8700' },
  { name: '현대카드', address: '서울특별시 영등포구 의사당대로 3', phone: '1577-6000' },
  { name: '롯데카드', address: '서울특별시 중구 을지로 30', phone: '1588-8100' },
  { name: '우리카드', address: '서울특별시 중구 소공로 51', phone: '1588-9955' },
  { name: '하나카드', address: '서울특별시 중구 을지로 35', phone: '1800-1111' },
  { name: 'NH농협카드', address: '서울특별시 중구 통일로 120', phone: '1644-4000' },
  { name: 'BC카드', address: '서울특별시 중구 을지로 170', phone: '1588-4000' },
  { name: '비씨카드', address: '서울특별시 중구 을지로 170', phone: '1588-4000' },

  // ─── 보험사 (생명) ───
  { name: '삼성생명', address: '서울특별시 서초구 서초대로74길 4', phone: '1588-3114' },
  { name: '한화생명', address: '서울특별시 영등포구 63로 50', phone: '1588-6363' },
  { name: '교보생명', address: '서울특별시 종로구 종로1', phone: '1588-1001' },
  { name: 'NH농협생명', address: '서울특별시 서대문구 충정로 60', phone: '1544-4000' },
  { name: '신한라이프', address: '서울특별시 중구 을지로2가', phone: '1588-5580' },
  { name: 'DB생명', address: '서울특별시 강남구 테헤란로 432', phone: '1588-3131' },
  { name: '메트라이프', address: '서울특별시 강남구 테헤란로 316', phone: '1588-9600' },
  { name: 'AIA생명', address: '서울특별시 중구 통일로 2', phone: '1588-9898' },
  { name: '미래에셋생명', address: '서울특별시 영등포구 국제금융로 56', phone: '1588-0220' },
  { name: '흥국생명', address: '서울특별시 종로구 율곡로 68', phone: '1588-2288' },
  { name: 'KB라이프', address: '서울특별시 종로구 새문안로 58', phone: '1588-9922' },
  { name: 'KDB생명', address: '서울특별시 영등포구 은행로 14', phone: '1588-4040' },
  { name: '푸본현대생명', address: '서울특별시 영등포구 여의대로 108', phone: '1588-6363' },
  { name: 'ABL생명', address: '서울특별시 영등포구 국제금융로 10', phone: '1588-6500' },
  { name: 'BNP파리바카디프생명', address: '서울특별시 중구 한강대로 416', phone: '1644-0100' },
  { name: '하나생명', address: '서울특별시 중구 을지로 66', phone: '1588-3288' },
  { name: 'DGB생명', address: '서울특별시 영등포구 국제금융로 10', phone: '1588-4770' },
  { name: 'iM라이프', address: '서울특별시 영등포구 국제금융로 10', phone: '1588-4770' },

  // ─── 보험사 (손해) ───
  { name: '삼성화재', address: '서울특별시 서초구 서초대로74길 14', phone: '1588-5114' },
  { name: 'DB손해보험', address: '서울특별시 강남구 테헤란로 432', phone: '1588-0100' },
  { name: 'DB손보', address: '서울특별시 강남구 테헤란로 432', phone: '1588-0100' },
  { name: '현대해상', address: '서울특별시 종로구 세종대로 163', phone: '1588-5656' },
  { name: 'KB손해보험', address: '서울특별시 강남구 테헤란로 117', phone: '1544-0114' },
  { name: 'KB손보', address: '서울특별시 강남구 테헤란로 117', phone: '1544-0114' },
  { name: '메리츠화재', address: '서울특별시 강남구 강남대로 382', phone: '1566-7711' },
  { name: '메리츠손해보험', address: '서울특별시 강남구 강남대로 382', phone: '1566-7711' },
  { name: '한화손해보험', address: '서울특별시 영등포구 63로 50', phone: '1566-8000' },
  { name: 'NH농협손해보험', address: '서울특별시 서대문구 충정로 60', phone: '1644-9000' },
  { name: '롯데손해보험', address: '서울특별시 중구 소월로2길 30', phone: '1588-3344' },
  { name: '흥국화재', address: '서울특별시 종로구 율곡로 68', phone: '1688-1688' },
  { name: 'MG손해보험', address: '서울특별시 강남구 삼성로 510', phone: '1588-5959' },

  // ─── 캐피탈·대부업 ───
  { name: '현대캐피탈', address: '서울특별시 영등포구 의사당대로 3', phone: '1588-6552' },
  { name: 'KB캐피탈', address: '서울특별시 중구 남대문로 52', phone: '1599-7900' },
  { name: '신한캐피탈', address: '서울특별시 영등포구 여의대로 70', phone: '1544-7200' },
  { name: '하나캐피탈', address: '서울특별시 중구 을지로 66', phone: '1800-0600' },
  { name: 'NH농협캐피탈', address: '서울특별시 서대문구 충정로 60', phone: '1644-3116' },
  { name: '우리금융캐피탈', address: '서울특별시 중구 소공로 51', phone: '1588-2511' },
  { name: 'BNK캐피탈', address: '부산광역시 남구 문현금융로 30', phone: '1588-2361' },
  { name: 'DGB캐피탈', address: '대구광역시 수성구 달구벌대로 2310', phone: '1577-8787' },
  { name: '아주캐피탈', address: '서울특별시 강남구 테헤란로 230', phone: '1588-4600' },
  { name: 'JB우리캐피탈', address: '전라북도 전주시 덕진구 백제대로 566', phone: '1544-8600' },
  { name: '롯데캐피탈', address: '서울특별시 중구 을지로 30', phone: '1588-8440' },
  { name: '산은캐피탈', address: '서울특별시 영등포구 은행로 14', phone: '1644-8288' },
  { name: '미래에셋캐피탈', address: '서울특별시 강남구 테헤란로 400', phone: '1588-6880' },
  { name: '한국캐피탈', address: '서울특별시 영등포구 국제금융로 10', phone: '1644-0700' },
  { name: '애큐온캐피탈', address: '서울특별시 영등포구 국제금융로6길 33', phone: '1600-2600' },
  { name: '오케이캐피탈', address: '서울특별시 중구 을지로 170', phone: '1800-2600' },

  // ─── 증권사 ───
  { name: '미래에셋증권', address: '서울특별시 중구 을지로5길 26', phone: '1588-6800' },
  { name: '한국투자증권', address: '서울특별시 영등포구 의사당대로 88', phone: '1544-5000' },
  { name: 'KB증권', address: '서울특별시 영등포구 여의나루로 50', phone: '1588-6611' },
  { name: 'NH투자증권', address: '서울특별시 영등포구 여의대로 60', phone: '1544-0000' },
  { name: '삼성증권', address: '서울특별시 서초구 서초대로74길 11', phone: '1588-2323' },
  { name: '신한투자증권', address: '서울특별시 영등포구 여의대로 70', phone: '1588-0365' },
  { name: '하나증권', address: '서울특별시 영등포구 의사당대로 82', phone: '1588-3111' },
  { name: '키움증권', address: '서울특별시 영등포구 여의나루로4길 18', phone: '1544-9000' },
  { name: '대신증권', address: '서울특별시 중구 삼일대로 343', phone: '1588-4488' },

  // ─── 공공기관·공단 ───
  { name: '한국장학재단', address: '대구광역시 동구 첨단로 97', phone: '1599-2000' },
  { name: '국민건강보험공단', address: '강원특별자치도 원주시 건강로 32', phone: '1577-1000' },
  { name: '국민연금공단', address: '전라북도 전주시 덕진구 기지로 180', phone: '1355' },
  { name: '근로복지공단', address: '울산광역시 중구 종가로 340', phone: '1588-0075' },
  { name: '한국자산관리공사', address: '부산광역시 남구 문현금융로 40', phone: '1588-3570' },
  { name: 'KAMCO', address: '부산광역시 남구 문현금융로 40', phone: '1588-3570' },
  { name: '서울보증보험', address: '서울특별시 종로구 종로 1', phone: '1670-7000' },
  { name: '신용보증기금', address: '대구광역시 동구 첨단로 7', phone: '1588-6565' },
  { name: '기술보증기금', address: '부산광역시 남구 문현금융로 33', phone: '1544-1120' },
  { name: '주택금융공사', address: '부산광역시 남구 문현금융로 40', phone: '1688-8114' },
  { name: '한국주택금융공사', address: '부산광역시 남구 문현금융로 40', phone: '1688-8114' },

  // ─── 대부업체 ───
  { name: '산와대부', address: '서울특별시 중구 다산로 172', phone: '1599-1000' },
  { name: '리드코프', address: '서울특별시 강남구 역삼로 234', phone: '1588-2882' },
  { name: '원캐싱', address: '서울특별시 강남구 테헤란로 151', phone: '1588-3600' },
  { name: '러시앤캐시', address: '서울특별시 중구 을지로 100', phone: '1588-3377' },
  { name: 'A&P파이낸셜', address: '서울특별시 강남구 테헤란로 131', phone: '1544-3600' },
  { name: '바로크레디트', address: '서울특별시 강남구 강남대로 310', phone: '1566-6400' },
  { name: 'OK금융그룹', address: '서울특별시 중구 을지로 170', phone: '1588-2614' },
  { name: '미즈사랑', address: '서울특별시 영등포구 여의대로 108', phone: '1566-0250' },

  // ─── 카카오·네이버·토스 핀테크 ───
  { name: '카카오페이', address: '경기도 성남시 분당구 판교역로 231', phone: '1644-7405' },
  { name: '네이버파이낸셜', address: '경기도 성남시 분당구 정자일로 95', phone: '1588-3819' },
  { name: '토스', address: '서울특별시 강남구 테헤란로 142', phone: '1599-4905' },
  { name: '비바리퍼블리카', address: '서울특별시 강남구 테헤란로 142', phone: '1599-4905' },
  { name: '핀다', address: '서울특별시 서초구 서초대로 396', phone: '1670-2882' },
];

/**
 * 채권자명으로 금융기관 정보를 찾는다.
 * 1순위: 정확히 일치
 * 2순위: 채권자명이 디렉토리 name을 포함
 * 3순위: 디렉토리 name이 채권자명을 포함
 */
export function findCreditor(creditorName: string): CreditorInfo | null {
  if (!creditorName) return null;

  const normalized = creditorName.trim();

  // 1순위: 정확 일치
  const exact = DIRECTORY.find(d => d.name === normalized);
  if (exact) return exact;

  // 2순위: 채권자명이 디렉토리명 포함 (ex: "KB국민은행 ○○지점" → KB국민은행)
  const contains = DIRECTORY.find(d => normalized.includes(d.name));
  if (contains) return contains;

  // 3순위: 디렉토리명이 채권자명 포함 (ex: "국민은행" → KB국민은행)
  const reverse = DIRECTORY.find(d => d.name.includes(normalized));
  if (reverse) return reverse;

  // 4순위: 키워드 부분 매칭 (ex: "국민" → KB국민은행)
  // 너무 짧은 키워드는 오매칭 방지
  if (normalized.length >= 2) {
    const partial = DIRECTORY.find(d => d.name.includes(normalized) || normalized.includes(d.name));
    if (partial) return partial;
  }

  return null;
}
