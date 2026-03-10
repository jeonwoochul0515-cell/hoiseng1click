import type { Context } from 'hono';
import type { Env } from './types';

// Regional price per sqm fallback data (KRW)
const REGIONAL_PRICES: Record<string, number> = {
  '서울': 8500000, '부산': 3500000, '대구': 3000000, '인천': 3800000,
  '광주': 2800000, '대전': 2700000, '울산': 2500000, '세종': 3200000,
  '경기': 4500000, '강원': 1800000, '충북': 1500000, '충남': 1600000,
  '전북': 1300000, '전남': 1200000, '경북': 1400000, '경남': 1600000, '제주': 2500000,
};

export async function handlePropertyLookup(c: Context<{ Bindings: Env }>) {
  const address = c.req.query('address') ?? '';
  const type = c.req.query('type') ?? 'apt';
  const area = Number(c.req.query('area') ?? 84);

  // Try real API first
  try {
    const apiKey = c.env.PUBLIC_DATA_API_KEY;
    if (apiKey) {
      const url = `http://apis.data.go.kr/1613000/RTMSDataSvcLandPrice/getRTMSDataSvcLandPrice?serviceKey=${apiKey}&LAWD_CD=11110&DEAL_YMD=202601&pageNo=1&numOfRows=10&type=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as any;
        const items = data?.response?.body?.items?.item;
        if (items && items.length > 0) {
          const price = Number(items[0].pblntfPclnd ?? 0) * 10000;
          return c.json({
            rawPrice: price,
            address,
            area,
            liquidation75: Math.floor(price * 0.75),
            source: 'api',
          });
        }
      }
    }
  } catch {
    /* fallback */
  }

  // Fallback: regional simulation
  const region = Object.keys(REGIONAL_PRICES).find(r => address.includes(r)) ?? '경기';
  const pricePerSqm = REGIONAL_PRICES[region] ?? 3000000;
  const rawPrice = pricePerSqm * area;

  return c.json({
    rawPrice,
    address,
    area,
    liquidation75: Math.floor(rawPrice * 0.75),
    source: 'simulation',
    region,
  });
}

// Vehicle base prices by model and age (simplified)
const VEHICLE_BASE: Record<string, number> = {
  '소나타': 28000000, '아반떼': 20000000, '그랜저': 38000000,
  'K5': 27000000, 'K8': 35000000, 'K3': 19000000,
  '셀토스': 24000000, '투싼': 30000000, '싼타페': 35000000,
  '쏘렌토': 38000000, '카니발': 40000000, '모닝': 12000000,
  '스파크': 11000000, '레이': 14000000, '스타리아': 35000000,
};

const DEPRECIATION: Record<number, number> = {
  0: 1.0, 1: 0.85, 2: 0.72, 3: 0.62, 4: 0.53,
  5: 0.45, 6: 0.38, 7: 0.32, 8: 0.27, 9: 0.23, 10: 0.20,
};

export async function handleVehicleLookup(c: Context<{ Bindings: Env }>) {
  const plate = c.req.query('plate') ?? '';
  const model = c.req.query('model') ?? '소나타';
  const year = Number(c.req.query('year') ?? new Date().getFullYear());
  const km = Number(c.req.query('km') ?? 50000);

  const age = Math.min(new Date().getFullYear() - year, 10);
  const baseNew = VEHICLE_BASE[model] ?? 25000000;
  const depRate = DEPRECIATION[age] ?? 0.15;
  const basePrice = Math.floor(baseNew * depRate);

  // Additional km adjustment
  const kmAdjust = km > 100000 ? 0.9 : km > 50000 ? 0.95 : 1.0;
  const adjustedPrice = Math.floor(basePrice * kmAdjust);

  return c.json({
    plate,
    model,
    year,
    km,
    basePrice: adjustedPrice,
    liquidation70: Math.floor(adjustedPrice * 0.70),
    source: 'internal_db',
  });
}
