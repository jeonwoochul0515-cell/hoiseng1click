import type { Context } from 'hono';
import type { Env } from './types';

// ──────────────────────────────────────────────
// 법정동코드 → LAWD_CD (시군구 5자리) 매핑
// ──────────────────────────────────────────────
const LAWD_CD: Record<string, string> = {
  // 서울
  '종로구': '11110', '중구': '11140', '용산구': '11170', '성동구': '11200',
  '광진구': '11215', '동대문구': '11230', '중랑구': '11260', '성북구': '11290',
  '강북구': '11305', '도봉구': '11320', '노원구': '11350', '은평구': '11380',
  '서대문구': '11410', '마포구': '11440', '양천구': '11470', '강서구': '11500',
  '구로구': '11530', '금천구': '11545', '영등포구': '11560', '동작구': '11590',
  '관악구': '11620', '서초구': '11650', '강남구': '11680', '송파구': '11710',
  '강동구': '11740',
  // 부산
  '해운대구': '26350', '사하구': '26380', '금정구': '26410',
  '연제구': '26470', '수영구': '26500', '사상구': '26530', '기장군': '26710',
  // 대구
  '달서구': '27200', '수성구': '27260', '달성군': '27710',
  // 인천
  '미추홀구': '28177', '연수구': '28185', '남동구': '28200',
  '부평구': '28237', '계양구': '28245',
  // 경기
  '수원시장안구': '41111', '수원시권선구': '41113', '수원시팔달구': '41115',
  '수원시영통구': '41117', '성남시분당구': '41135',
  '고양시일산동구': '41285', '고양시일산서구': '41287',
  '용인시기흥구': '41463', '용인시수지구': '41465',
  '부천시': '41190', '안양시동안구': '41173', '화성시': '41590',
  '김포시': '41570', '남양주시': '41360', '파주시': '41480',
  '광명시': '41210', '시흥시': '41390', '하남시': '41450',
};

function extractLawdCd(address: string): string | null {
  for (const [key, code] of Object.entries(LAWD_CD)) {
    if (address.includes(key)) return code;
  }
  return null;
}

const REGIONAL_PRICES: Record<string, number> = {
  '서울': 8500000, '부산': 3500000, '대구': 3000000, '인천': 3800000,
  '광주': 2800000, '대전': 2700000, '울산': 2500000, '세종': 3200000,
  '경기': 4500000, '강원': 1800000, '충북': 1500000, '충남': 1600000,
  '전북': 1300000, '전남': 1200000, '경북': 1400000, '경남': 1600000, '제주': 2500000,
};

// ── 부동산 공시가격 조회 ──
export async function handlePropertyLookup(c: Context<{ Bindings: Env }>) {
  const address = c.req.query('address') ?? '';
  const type = c.req.query('type') ?? 'apt';
  const area = Number(c.req.query('area') ?? 84);
  const pnu = c.req.query('pnu') ?? '';

  const apiKey = c.env.PUBLIC_DATA_API_KEY;

  // 1) PNU 기반 공시가격 API
  if (apiKey && pnu) {
    try {
      const result = await fetchByPnu(apiKey, pnu, type, address, area);
      if (result) return c.json(result);
    } catch { /* fallback */ }
  }

  // 2) 주소 기반 실거래가 API
  if (apiKey && type === 'apt') {
    try {
      const result = await fetchAptTradePrice(apiKey, address, area);
      if (result) return c.json(result);
    } catch { /* fallback */ }
  }

  // 3) 시뮬레이션 폴백
  const region = Object.keys(REGIONAL_PRICES).find(r => address.includes(r)) ?? '경기';
  const pricePerSqm = REGIONAL_PRICES[region] ?? 3000000;
  const rawPrice = pricePerSqm * area;

  return c.json({
    rawPrice, address, area,
    liquidation75: Math.floor(rawPrice * 0.75),
    source: 'simulation', region,
  });
}

async function fetchByPnu(apiKey: string, pnu: string, propertyType: string, address: string, area: number) {
  let apiUrl: string;
  let priceField: string;
  switch (propertyType) {
    case 'apt':
      apiUrl = 'http://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr';
      priceField = 'pblntfPc'; break;
    case 'house':
      apiUrl = 'http://apis.data.go.kr/1611000/nsdi/IndvdHousingPriceService/attr/getIndvdHousingPriceAttr';
      priceField = 'pblntfPc'; break;
    default:
      apiUrl = 'http://apis.data.go.kr/1611000/nsdi/IndvdLandPriceService/attr/getIndvdLandPriceAttr';
      priceField = 'pblntfPclnd'; break;
  }

  const stdrYear = new Date().getFullYear().toString();
  const params = new URLSearchParams({ serviceKey: apiKey, pnu, stdrYear, format: 'json', numOfRows: '10', pageNo: '1' });
  const res = await fetch(`${apiUrl}?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json() as any;
  const fields = data?.indvdLandPrices?.field ?? data?.apartHousingPrices?.field ?? data?.indvdHousingPrices?.field ?? [];
  const firstItem = Array.isArray(fields) ? fields[0] : fields;
  if (!firstItem?.[priceField]) return null;

  const rawPrice = Number(firstItem[priceField]);
  const totalPrice = propertyType === 'land' ? rawPrice * area : rawPrice;
  return { rawPrice: totalPrice, address, area, propertyType, liquidation75: Math.floor(totalPrice * 0.75), source: 'api', stdrYear };
}

async function fetchAptTradePrice(apiKey: string, address: string, area: number) {
  const lawdCd = extractLawdCd(address);
  if (!lawdCd) return null;

  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dealYmd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams({ serviceKey: apiKey, LAWD_CD: lawdCd, DEAL_YMD: dealYmd, pageNo: '1', numOfRows: '50' });
    const url = `http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${params}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      const items = parseXmlItems(text);
      if (items.length === 0) continue;

      let matched = items.filter(item => Math.abs(parseFloat(item.excluUseAr ?? '0') - area) <= 10);
      if (matched.length === 0) matched = items.filter(item => Math.abs(parseFloat(item.excluUseAr ?? '0') - area) <= 15);
      if (matched.length === 0) continue;

      const prices = matched.map(item => Number(String(item.dealAmount ?? '0').replace(/,/g, '').trim()) * 10000).filter(p => p > 0);
      if (prices.length === 0) continue;

      prices.sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      const estimatedOfficial = Math.floor(median * 0.7);

      return {
        rawPrice: estimatedOfficial, marketPrice: median, address, area, propertyType: 'apt',
        liquidation75: Math.floor(estimatedOfficial * 0.75),
        source: 'api_trade', dealYmd, sampleCount: prices.length,
      };
    } catch { continue; }
  }
  return null;
}

function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const fields: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRegex.exec(m[1])) !== null) { fields[f[1]] = f[2].trim(); }
    items.push(fields);
  }
  return items;
}

// ── 차량 기준가액 조회 (확장 DB) ──

const VEHICLE_BASE: Record<string, number> = {
  // 현대
  '소나타': 28000000, '아반떼': 20000000, '그랜저': 38000000,
  '캐스퍼': 14500000, '베뉴': 19500000, '코나': 25000000,
  '투싼': 30000000, '싼타페': 38000000, '팰리세이드': 42000000,
  '아이오닉5': 47000000, '아이오닉6': 46000000, '스타리아': 35000000,
  '포터': 22000000,
  // 기아
  '모닝': 12000000, '레이': 14000000, 'K3': 19000000,
  'K5': 27000000, 'K8': 35000000, 'K9': 50000000,
  '셀토스': 24000000, '스포티지': 29000000, '쏘렌토': 38000000,
  '카니발': 40000000, 'EV6': 48000000, 'EV9': 58000000, '니로': 28000000, '봉고': 20000000,
  // 제네시스
  'G70': 42000000, 'G80': 55000000, 'G90': 85000000,
  'GV60': 48000000, 'GV70': 50000000, 'GV80': 62000000,
  // 쌍용
  '티볼리': 20000000, '코란도': 25000000, '렉스턴': 38000000, '토레스': 27000000,
  // 르노
  'SM6': 25000000, 'XM3': 22000000, 'QM6': 32000000,
  // 쉐보레
  '스파크': 11000000, '트레일블레이저': 25000000, '트랙스': 22000000, '이쿼녹스': 35000000,
  // 수입차
  '3시리즈': 52000000, '5시리즈': 68000000, 'X3': 60000000, 'X5': 85000000,
  'C클래스': 55000000, 'E클래스': 72000000, 'GLC': 65000000,
  'A4': 48000000, 'A6': 60000000, 'Q5': 58000000,
  '모델3': 50000000, '모델Y': 55000000,
  '캠리': 35000000, 'RAV4': 38000000,
};

const DEPRECIATION: Record<number, number> = {
  0: 1.00, 1: 0.82, 2: 0.70, 3: 0.60, 4: 0.52,
  5: 0.44, 6: 0.37, 7: 0.31, 8: 0.26, 9: 0.22,
  10: 0.19, 11: 0.16, 12: 0.14, 13: 0.12, 14: 0.10, 15: 0.08,
};

function mileageAdjust(km: number, age: number): number {
  if (age <= 0) return 1.0;
  const ratio = km / (age * 15000);
  if (ratio < 0.7) return 1.05;
  if (ratio < 1.0) return 1.00;
  if (ratio < 1.3) return 0.95;
  if (ratio < 1.6) return 0.90;
  return 0.85;
}

export async function handleVehicleLookup(c: Context<{ Bindings: Env }>) {
  const plate = c.req.query('plate') ?? '';
  const model = c.req.query('model') ?? '소나타';
  const year = Number(c.req.query('year') ?? new Date().getFullYear());
  const km = Number(c.req.query('km') ?? 50000);

  const currentYear = new Date().getFullYear();
  const age = Math.min(Math.max(currentYear - year, 0), 15);
  const baseNew = VEHICLE_BASE[model] ?? 25000000;
  const depRate = DEPRECIATION[age] ?? 0.08;
  const kmAdj = mileageAdjust(km, age);
  const basePrice = Math.floor(baseNew * depRate * kmAdj);

  return c.json({
    plate, model, year, km, age, basePrice,
    liquidation70: Math.floor(basePrice * 0.70),
    depreciationRate: depRate, mileageAdjust: kmAdj,
    source: 'internal_db',
  });
}
