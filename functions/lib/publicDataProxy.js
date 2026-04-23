"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePropertyLookup = handlePropertyLookup;
exports.handleVehicleLookup = handleVehicleLookup;
exports.handleAptOfficialPrice = handleAptOfficialPrice;
exports.handleHouseOfficialPrice = handleHouseOfficialPrice;
exports.handleLandOfficialPrice = handleLandOfficialPrice;
exports.addressToPnu = addressToPnu;
exports.handleAddressToPnu = handleAddressToPnu;
// ──────────────────────────────────────────────
// [Phase B-2] VWORLD 국가중점데이터 API — 공시가격 3종
// data.go.kr "(WMS/WFS/속성정보)" 시리즈의 실제 서비스 제공자.
// 응답 포맷은 구 data.go.kr NSDI 와 동일 (host 와 key 파라미터 이름만 차이).
// 호출 시 Referer 헤더 필수 (VWORLD 인증키 등록 URL 과 일치).
// ──────────────────────────────────────────────
const VWORLD_PRICE_API = {
    APT: "https://api.vworld.kr/ned/data/getApartHousingPriceAttr",
    HOUSE: "https://api.vworld.kr/ned/data/getIndvdHousingPriceAttr",
    LAND: "https://api.vworld.kr/ned/data/getIndvdLandPriceAttr",
};
const VWORLD_REFERER = "https://hoiseng1click.web.app";
// 응답 공시가격 필드명
const PRICE_FIELD = {
    APT: "pblntfPc", // 공동주택: 공시가격(원)
    HOUSE: "pblntfPc", // 개별주택: 공시가격(원)
    LAND: "pblntfPclnd", // 개별지가: 공시지가(원/㎡)
};
// (구) data.go.kr 경로 — 활용신청 안 된 상태라 미사용. 참조용 보존.
const DATA_GO_KR_PRICE_API = {
    APT: "https://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr",
    HOUSE: "https://apis.data.go.kr/1611000/nsdi/IndvdHousingPriceService/attr/getIndvdHousingPriceAttr",
    LAND: "https://apis.data.go.kr/1611000/nsdi/IndvdLandPriceService/attr/getIndvdLandPriceAttr",
};
// ──────────────────────────────────────────────
// 법정동코드 → LAWD_CD (시군구 5자리) 매핑
// ──────────────────────────────────────────────
const LAWD_CD = {
    // 서울
    "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
    "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
    "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
    "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
    "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
    "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
    "강동구": "11740",
    // 부산
    "중구부산": "26110", "서구부산": "26140", "동구부산": "26170", "영도구": "26200",
    "부산진구": "26230", "동래구": "26260", "남구부산": "26290", "북구부산": "26320",
    "해운대구": "26350", "사하구": "26380", "금정구": "26410", "강서구부산": "26440",
    "연제구": "26470", "수영구": "26500", "사상구": "26530", "기장군": "26710",
    // 대구
    "달서구": "27200", "수성구": "27260", "달성군": "27710",
    // 인천
    "미추홀구": "28177", "연수구": "28185", "남동구": "28200", "부평구": "28237",
    "계양구": "28245", "서구인천": "28260",
    // 경기
    "수원시장안구": "41111", "수원시권선구": "41113", "수원시팔달구": "41115",
    "수원시영통구": "41117", "성남시수정구": "41131", "성남시중원구": "41133",
    "성남시분당구": "41135", "의정부시": "41150", "안양시만안구": "41171",
    "안양시동안구": "41173", "부천시": "41190", "광명시": "41210",
    "평택시": "41220", "동두천시": "41250", "안산시상록구": "41271",
    "안산시단원구": "41273", "고양시덕양구": "41281", "고양시일산동구": "41285",
    "고양시일산서구": "41287", "과천시": "41290", "구리시": "41310",
    "남양주시": "41360", "오산시": "41370", "시흥시": "41390",
    "군포시": "41410", "의왕시": "41430", "하남시": "41450",
    "용인시처인구": "41461", "용인시기흥구": "41463", "용인시수지구": "41465",
    "파주시": "41480", "이천시": "41500", "안성시": "41550",
    "김포시": "41570", "화성시": "41590", "광주시": "41610",
    "양주시": "41630", "포천시": "41650",
};
/**
 * 주소 문자열에서 LAWD_CD 추출
 * "서울특별시 강남구 역삼동 ..." → "11680"
 */
function extractLawdCd(address) {
    // 시군구 + 구 조합으로 먼저 시도 (예: "수원시영통구")
    for (const [key, code] of Object.entries(LAWD_CD)) {
        if (address.includes(key))
            return code;
    }
    // 단순 구 이름 매칭
    for (const [key, code] of Object.entries(LAWD_CD)) {
        const shortKey = key.replace(/시$/, "");
        if (address.includes(shortKey) && shortKey.length >= 2)
            return code;
    }
    return null;
}
// 지역별 평당가 (시뮬레이션 폴백용, 원/㎡)
const REGIONAL_PRICES = {
    "서울": 8500000, "부산": 3500000, "대구": 3000000, "인천": 3800000,
    "광주": 2800000, "대전": 2700000, "울산": 2500000, "세종": 3200000,
    "경기": 4500000, "강원": 1800000, "충북": 1500000, "충남": 1600000,
    "전북": 1300000, "전남": 1200000, "경북": 1400000, "경남": 1600000, "제주": 2500000,
};
// ──────────────────────────────────────────────
// 부동산 공시가격 조회
// ──────────────────────────────────────────────
async function handlePropertyLookup(req, res) {
    const address = req.query.address ?? "";
    const area = Number(req.query.area ?? 84);
    const propertyType = req.query.type ?? "apt";
    const pnu = req.query.pnu ?? "";
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    // ── 1) PNU가 있으면 공시가격 NSDI API 호출 ──
    if (apiKey && pnu) {
        try {
            const result = await fetchByPnu(apiKey, pnu, propertyType, address, area);
            if (result) {
                res.json(result);
                return;
            }
        }
        catch { /* fallback */ }
    }
    // ── 2) 주소 기반으로 아파트 실거래가 API 호출 ──
    if (apiKey && propertyType === "apt") {
        try {
            const result = await fetchAptTradePrice(apiKey, address, area);
            if (result) {
                res.json(result);
                return;
            }
        }
        catch { /* fallback */ }
    }
    // ── 2-b) 단독/다가구 실거래가 API 호출 ──
    if (apiKey && propertyType === "house") {
        try {
            const result = await fetchSingleHouseTradePrice(apiKey, address, area);
            if (result) {
                res.json(result);
                return;
            }
        }
        catch { /* fallback */ }
    }
    // ── 2-c) 연립/다세대 실거래가 API 호출 ──
    if (apiKey && propertyType === "rowhouse") {
        try {
            const result = await fetchRowHouseTradePrice(apiKey, address, area);
            if (result) {
                res.json(result);
                return;
            }
        }
        catch { /* fallback */ }
    }
    // ── 2-d) 오피스텔 실거래가 API 호출 ──
    if (apiKey && propertyType === "officetel") {
        try {
            const result = await fetchOfficetelTradePrice(apiKey, address, area);
            if (result) {
                res.json(result);
                return;
            }
        }
        catch { /* fallback */ }
    }
    // ── 3) 시뮬레이션 폴백 ──
    fallbackSimulation(res, address, area);
}
/** PNU 기반 공시가격 NSDI API */
async function fetchByPnu(apiKey, pnu, propertyType, address, area) {
    let apiUrl;
    let priceField;
    switch (propertyType) {
        case "apt":
            apiUrl = DATA_GO_KR_PRICE_API.APT;
            priceField = PRICE_FIELD.APT;
            break;
        case "house":
            apiUrl = DATA_GO_KR_PRICE_API.HOUSE;
            priceField = PRICE_FIELD.HOUSE;
            break;
        case "land":
        default:
            apiUrl = DATA_GO_KR_PRICE_API.LAND;
            priceField = PRICE_FIELD.LAND;
            break;
    }
    const stdrYear = new Date().getFullYear().toString();
    const params = new URLSearchParams({
        serviceKey: apiKey, pnu, stdrYear, format: "json", numOfRows: "10", pageNo: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${apiUrl}?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok)
        return null;
    const data = (await r.json());
    const fields = data?.indvdLandPrices?.field ??
        data?.apartHousingPrices?.field ??
        data?.indvdHousingPrices?.field ??
        [];
    const firstItem = Array.isArray(fields) ? fields[0] : fields;
    if (!firstItem?.[priceField])
        return null;
    const rawPrice = Number(firstItem[priceField]);
    const totalPrice = propertyType === "land" ? rawPrice * area : rawPrice;
    return {
        rawPrice: totalPrice,
        address,
        area,
        propertyType,
        liquidation75: Math.floor(totalPrice * 0.75),
        source: "api",
        stdrYear,
    };
}
/** 주소 기반 아파트 매매 실거래가 API (최근 거래 기준) */
async function fetchAptTradePrice(apiKey, address, area) {
    const lawdCd = extractLawdCd(address);
    if (!lawdCd)
        return null;
    // 최근 3개월 내 거래를 검색
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    for (const dealYmd of months) {
        const params = new URLSearchParams({
            serviceKey: apiKey,
            LAWD_CD: lawdCd,
            DEAL_YMD: dealYmd,
            pageNo: "1",
            numOfRows: "50",
        });
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?${params}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!r.ok)
                continue;
            const text = await r.text();
            // XML 파싱 (data.go.kr 기본 응답이 XML)
            const items = parseXmlItems(text);
            if (items.length === 0)
                continue;
            // 주소에서 동/단지 이름 추출하여 매칭 시도
            const dongName = extractDong(address);
            const aptName = extractAptName(address);
            // 면적 ±10㎡ 범위 내, 동 이름 매칭 우선
            let matched = items.filter((item) => {
                const excluArea = parseFloat(item.excluUseAr ?? "0");
                const areaMatch = Math.abs(excluArea - area) <= 10;
                const dongMatch = dongName ? (item.umdNm ?? "").includes(dongName) : true;
                return areaMatch && dongMatch;
            });
            // 아파트 이름 매칭
            if (aptName && matched.length > 1) {
                const aptMatched = matched.filter((item) => (item.aptNm ?? "").includes(aptName));
                if (aptMatched.length > 0)
                    matched = aptMatched;
            }
            if (matched.length === 0) {
                // 면적만으로 매칭
                matched = items.filter((item) => {
                    const excluArea = parseFloat(item.excluUseAr ?? "0");
                    return Math.abs(excluArea - area) <= 15;
                });
            }
            if (matched.length === 0)
                continue;
            // 최근 거래 가격 (만원 단위 → 원 단위)
            const prices = matched
                .map((item) => Number(String(item.dealAmount ?? "0").replace(/,/g, "").trim()) * 10000)
                .filter((p) => p > 0);
            if (prices.length === 0)
                continue;
            // 중앙값 사용
            prices.sort((a, b) => a - b);
            const median = prices[Math.floor(prices.length / 2)];
            // 실거래가 → 공시가격 추정 (공시가격현실화율 약 70%)
            const estimatedOfficialPrice = Math.floor(median * 0.7);
            return {
                rawPrice: estimatedOfficialPrice,
                marketPrice: median,
                address,
                area,
                propertyType: "apt",
                liquidation75: Math.floor(estimatedOfficialPrice * 0.75),
                source: "api_trade",
                dealYmd,
                sampleCount: prices.length,
            };
        }
        catch {
            clearTimeout(timeout);
            continue;
        }
    }
    return null;
}
/**
 * 주소 기반 단독/다가구 매매 실거래가 API
 * — 연면적 기준으로 매칭, 단독주택 공시가격 현실화율은 약 60%
 */
async function fetchSingleHouseTradePrice(apiKey, address, area) {
    return fetchTradeByType({
        apiKey, address, area,
        endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
        areaField: "totalFloorAr",
        areaTolerance: 15,
        officialRate: 0.6,
        propertyType: "house",
    });
}
/**
 * 주소 기반 연립/다세대 매매 실거래가 API
 */
async function fetchRowHouseTradePrice(apiKey, address, area) {
    return fetchTradeByType({
        apiKey, address, area,
        endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
        areaField: "excluUseAr",
        areaTolerance: 10,
        officialRate: 0.65,
        propertyType: "rowhouse",
    });
}
/**
 * 주소 기반 오피스텔 매매 실거래가 API
 */
async function fetchOfficetelTradePrice(apiKey, address, area) {
    return fetchTradeByType({
        apiKey, address, area,
        endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
        areaField: "excluUseAr",
        areaTolerance: 10,
        officialRate: 0.7,
        propertyType: "officetel",
    });
}
/** 공통 실거래가 조회 루틴 (단독/연립/오피스텔) */
async function fetchTradeByType(opts) {
    const lawdCd = extractLawdCd(opts.address);
    if (!lawdCd)
        return null;
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    for (const dealYmd of months) {
        const params = new URLSearchParams({
            serviceKey: opts.apiKey,
            LAWD_CD: lawdCd,
            DEAL_YMD: dealYmd,
            pageNo: "1",
            numOfRows: "50",
        });
        const url = `${opts.endpoint}?${params}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!r.ok)
                continue;
            const text = await r.text();
            const items = parseXmlItems(text);
            if (items.length === 0)
                continue;
            const dongName = extractDong(opts.address);
            let matched = items.filter((item) => {
                const itemArea = parseFloat(item[opts.areaField] ?? "0");
                const areaMatch = Math.abs(itemArea - opts.area) <= opts.areaTolerance;
                const dongMatch = dongName ? (item.umdNm ?? "").includes(dongName) : true;
                return areaMatch && dongMatch;
            });
            if (matched.length === 0) {
                matched = items.filter((item) => {
                    const itemArea = parseFloat(item[opts.areaField] ?? "0");
                    return Math.abs(itemArea - opts.area) <= opts.areaTolerance + 5;
                });
            }
            if (matched.length === 0)
                continue;
            const prices = matched
                .map((item) => Number(String(item.dealAmount ?? "0").replace(/,/g, "").trim()) * 10000)
                .filter((p) => p > 0);
            if (prices.length === 0)
                continue;
            prices.sort((a, b) => a - b);
            const median = prices[Math.floor(prices.length / 2)];
            const estimatedOfficialPrice = Math.floor(median * opts.officialRate);
            return {
                rawPrice: estimatedOfficialPrice,
                marketPrice: median,
                address: opts.address,
                area: opts.area,
                propertyType: opts.propertyType,
                liquidation75: Math.floor(estimatedOfficialPrice * 0.75),
                source: "api_trade",
                dealYmd,
                sampleCount: prices.length,
            };
        }
        catch {
            clearTimeout(timeout);
            continue;
        }
    }
    return null;
}
/** 간이 XML 파서 — <item> 요소들 추출 */
function parseXmlItems(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRegex.exec(xml)) !== null) {
        const fields = {};
        const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
        let f;
        while ((f = fieldRegex.exec(m[1])) !== null) {
            fields[f[1]] = f[2].trim();
        }
        items.push(fields);
    }
    return items;
}
/** 주소에서 동 이름 추출: "서울 강남구 역삼동" → "역삼" */
function extractDong(address) {
    const m = address.match(/(\S+?)[동리읍면]\s/);
    return m ? m[1] : null;
}
/** 주소에서 아파트 이름 추출 (선택) */
function extractAptName(address) {
    // "래미안 퍼스티지", "힐스테이트" 등 아파트 이름이 주소 끝에 있을 수 있음
    const keywords = ["아파트", "APT", "빌라", "맨션", "타운"];
    for (const kw of keywords) {
        const idx = address.indexOf(kw);
        if (idx > 0) {
            // 아파트 키워드 앞의 단어 추출
            const before = address.substring(0, idx).trim().split(/\s+/);
            return before[before.length - 1] ?? null;
        }
    }
    return null;
}
function fallbackSimulation(res, address, area) {
    const region = Object.keys(REGIONAL_PRICES).find((r) => address.includes(r)) ?? "경기";
    const pricePerSqm = REGIONAL_PRICES[region] ?? 3000000;
    const rawPrice = pricePerSqm * area;
    res.json({
        rawPrice,
        address,
        area,
        liquidation75: Math.floor(rawPrice * 0.75),
        source: "simulation",
        region,
    });
}
// ──────────────────────────────────────────────
// 차량 기준가액 조회 (확장 데이터베이스)
// ──────────────────────────────────────────────
// 제조사별 차종 데이터 (2024~2026 신차가격 기준, 만원)
const VEHICLE_BASE = {
    // 현대
    "소나타": 28000000, "아반떼": 20000000, "그랜저": 38000000,
    "캐스퍼": 14500000, "베뉴": 19500000, "코나": 25000000,
    "투싼": 30000000, "싼타페": 38000000, "팰리세이드": 42000000,
    "아이오닉5": 47000000, "아이오닉6": 46000000, "넥쏘": 70000000,
    "스타리아": 35000000, "포터": 22000000, "마이티": 35000000,
    // 기아
    "모닝": 12000000, "레이": 14000000, "K3": 19000000,
    "K5": 27000000, "K8": 35000000, "K9": 50000000,
    "셀토스": 24000000, "스포티지": 29000000, "쏘렌토": 38000000,
    "카니발": 40000000, "EV6": 48000000, "EV9": 58000000,
    "니로": 28000000, "봉고": 20000000,
    // 제네시스
    "G70": 42000000, "G80": 55000000, "G90": 85000000,
    "GV60": 48000000, "GV70": 50000000, "GV80": 62000000,
    // 쌍용(KG모빌리티)
    "티볼리": 20000000, "코란도": 25000000, "렉스턴": 38000000,
    "토레스": 27000000, "액티언": 22000000,
    // 르노코리아
    "SM6": 25000000, "XM3": 22000000, "QM6": 32000000,
    "아르카나": 30000000, "마스터": 33000000,
    // 쉐보레
    "스파크": 11000000, "트레일블레이저": 25000000,
    "트랙스": 22000000, "이쿼녹스": 35000000, "트래버스": 52000000,
    "볼트EV": 35000000, "볼트EUV": 38000000, "콜로라도": 40000000,
    // 수입차 (주요 모델)
    "3시리즈": 52000000, "5시리즈": 68000000, "X3": 60000000, "X5": 85000000,
    "C클래스": 55000000, "E클래스": 72000000, "GLC": 65000000, "GLE": 90000000,
    "A4": 48000000, "A6": 60000000, "Q5": 58000000, "Q7": 80000000,
    "골프": 35000000, "티구안": 42000000, "모델3": 50000000, "모델Y": 55000000,
    "캠리": 35000000, "RAV4": 38000000, "시빅": 30000000, "CR-V": 38000000,
};
// 연식별 감가율 (보험개발원 기준가액 근사치)
const DEPRECIATION = {
    0: 1.00, 1: 0.82, 2: 0.70, 3: 0.60, 4: 0.52,
    5: 0.44, 6: 0.37, 7: 0.31, 8: 0.26, 9: 0.22,
    10: 0.19, 11: 0.16, 12: 0.14, 13: 0.12, 14: 0.10, 15: 0.08,
};
// 주행거리 보정 계수 (연평균 15,000km 기준)
function mileageAdjust(km, age) {
    if (age <= 0)
        return 1.0;
    const expectedKm = age * 15000;
    const ratio = km / expectedKm;
    if (ratio < 0.7)
        return 1.05; // 주행거리 적음: +5%
    if (ratio < 1.0)
        return 1.00; // 평균 이하: 기본
    if (ratio < 1.3)
        return 0.95; // 평균 이상: -5%
    if (ratio < 1.6)
        return 0.90; // 많음: -10%
    return 0.85; // 매우 많음: -15%
}
async function handleVehicleLookup(req, res) {
    const plate = req.query.plate ?? "";
    const model = req.query.model ?? "소나타";
    const year = Number(req.query.year ?? new Date().getFullYear());
    const km = Number(req.query.km ?? 50000);
    const currentYear = new Date().getFullYear();
    const age = Math.min(Math.max(currentYear - year, 0), 15);
    const baseNew = VEHICLE_BASE[model] ?? 25000000;
    const depRate = DEPRECIATION[age] ?? 0.08;
    const kmAdj = mileageAdjust(km, age);
    const basePrice = Math.floor(baseNew * depRate * kmAdj);
    res.json({
        plate,
        model,
        year,
        km,
        age,
        basePrice,
        liquidation70: Math.floor(basePrice * 0.70),
        depreciationRate: depRate,
        mileageAdjust: kmAdj,
        source: "internal_db",
    });
}
// ═══════════════════════════════════════════════════════════════════════════
// [Phase B-1/B-2] data.go.kr 공시가격 3종 프록시 + PNU 변환 유틸
// ═══════════════════════════════════════════════════════════════════════════
/**
 * data.go.kr NSDI 공시가격 API 공통 호출 헬퍼.
 * PNU 19자리 + 기준연도(YYYY)로 조회.
 * 응답은 JSON(또는 XML) — NSDI는 보통 JSON 지원.
 */
/**
 * VWORLD 국가중점데이터 API 로 공시가격 조회.
 * 응답 포맷: NSDI 표준 — { apartHousingPrices|indvdHousingPrices|indvdLandPrices: { field: [...] } }
 * 주의: Referer 헤더 필수 (VWORLD 인증키 등록 URL 과 일치).
 */
async function fetchOfficialPriceByPnu(opts) {
    const params = new URLSearchParams({
        key: opts.vworldKey,
        pnu: opts.pnu,
        stdrYear: opts.stdrYear,
        format: "json",
        numOfRows: "10",
        pageNo: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const r = await fetch(`${opts.apiUrl}?${params}`, {
            signal: controller.signal,
            headers: { Referer: opts.referer ?? VWORLD_REFERER },
        });
        clearTimeout(timeout);
        if (!r.ok)
            return null;
        const data = (await r.json());
        const fields = data?.indvdLandPrices?.field ??
            data?.apartHousingPrices?.field ??
            data?.indvdHousingPrices?.field ??
            data?.field ??
            [];
        const first = Array.isArray(fields) ? fields[0] : fields;
        if (!first)
            return null;
        const rawPrice = Number(first[opts.priceField] ?? 0);
        if (!rawPrice)
            return null;
        return {
            rawPrice,
            pnu: opts.pnu,
            stdrYear: opts.stdrYear,
            address: String(first.ldCodeNm ?? first.sggCdNm ?? first.bjdongNm ?? ""),
            standardDate: String(first.lastUpdtDt ?? first.pblntfDe ?? first.stdrYear ?? opts.stdrYear),
            raw: first,
        };
    }
    catch {
        clearTimeout(timeout);
        return null;
    }
}
/**
 * POST /public/apt-price
 * body: { pnu: string, stdrYear?: string, address?: string }
 * 공동주택(아파트) 공시가격 조회 — data.go.kr NSDI
 */
async function handleAptOfficialPrice(req, res) {
    try {
        const { pnu, stdrYear, address } = (req.body ?? {});
        const vworldKey = process.env.VWORLD_API_KEY ?? "";
        if (!vworldKey) {
            res.status(500).json({ error: "VWORLD_API_KEY 미설정" });
            return;
        }
        // PNU 가 없고 주소만 있으면 변환 시도
        let targetPnu = (pnu ?? "").trim();
        if (!targetPnu && address) {
            const converted = await addressToPnu(address);
            if (converted)
                targetPnu = converted;
        }
        if (!targetPnu || targetPnu.length !== 19) {
            res.json({
                rawPrice: 0, liquidation75: 0, source: "no_pnu",
                message: "PNU(19자리)를 확인할 수 없습니다. 주소를 구체적으로 입력하거나 PNU를 직접 입력해주세요.",
            });
            return;
        }
        const year = (stdrYear && /^\d{4}$/.test(stdrYear))
            ? stdrYear
            : String(new Date().getFullYear());
        const result = await fetchOfficialPriceByPnu({
            apiUrl: VWORLD_PRICE_API.APT,
            priceField: PRICE_FIELD.APT,
            vworldKey,
            pnu: targetPnu,
            stdrYear: year,
        });
        if (!result) {
            res.json({
                rawPrice: 0, pnu: targetPnu, stdrYear: year, liquidation75: 0,
                source: "no_data",
                message: "해당 PNU/연도의 공시가격 데이터가 없습니다.",
            });
            return;
        }
        res.json({
            rawPrice: result.rawPrice,
            address: result.address || address || "",
            pnu: result.pnu,
            stdrYear: result.stdrYear,
            standardDate: result.standardDate,
            propertyType: "apt",
            liquidation75: Math.floor(result.rawPrice * 0.75),
            source: "vworld",
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "공시가격 조회 실패" });
    }
}
/**
 * POST /public/house-price
 * body: { pnu: string, stdrYear?: string, address?: string }
 * 개별단독주택 공시가격
 */
async function handleHouseOfficialPrice(req, res) {
    try {
        const { pnu, stdrYear, address } = (req.body ?? {});
        const vworldKey = process.env.VWORLD_API_KEY ?? "";
        if (!vworldKey) {
            res.status(500).json({ error: "VWORLD_API_KEY 미설정" });
            return;
        }
        let targetPnu = (pnu ?? "").trim();
        if (!targetPnu && address) {
            const converted = await addressToPnu(address);
            if (converted)
                targetPnu = converted;
        }
        if (!targetPnu || targetPnu.length !== 19) {
            res.json({
                rawPrice: 0, liquidation75: 0, source: "no_pnu",
                message: "PNU(19자리)를 확인할 수 없습니다.",
            });
            return;
        }
        const year = (stdrYear && /^\d{4}$/.test(stdrYear))
            ? stdrYear
            : String(new Date().getFullYear());
        const result = await fetchOfficialPriceByPnu({
            apiUrl: VWORLD_PRICE_API.HOUSE,
            priceField: PRICE_FIELD.HOUSE,
            vworldKey,
            pnu: targetPnu,
            stdrYear: year,
        });
        if (!result) {
            res.json({
                rawPrice: 0, pnu: targetPnu, stdrYear: year, liquidation75: 0,
                source: "no_data",
                message: "해당 PNU/연도의 개별주택 공시가격 데이터가 없습니다.",
            });
            return;
        }
        res.json({
            rawPrice: result.rawPrice,
            address: result.address || address || "",
            pnu: result.pnu,
            stdrYear: result.stdrYear,
            standardDate: result.standardDate,
            propertyType: "house",
            liquidation75: Math.floor(result.rawPrice * 0.75),
            source: "vworld",
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "개별주택 공시가격 조회 실패" });
    }
}
/**
 * POST /public/land-price
 * body: { pnu: string, stdrYear?: string, address?: string, area?: number }
 * 개별공시지가 — 원/㎡ 단위이므로 area 가 있으면 총액도 함께 반환
 */
async function handleLandOfficialPrice(req, res) {
    try {
        const { pnu, stdrYear, address, area } = (req.body ?? {});
        const vworldKey = process.env.VWORLD_API_KEY ?? "";
        if (!vworldKey) {
            res.status(500).json({ error: "VWORLD_API_KEY 미설정" });
            return;
        }
        let targetPnu = (pnu ?? "").trim();
        if (!targetPnu && address) {
            const converted = await addressToPnu(address);
            if (converted)
                targetPnu = converted;
        }
        if (!targetPnu || targetPnu.length !== 19) {
            res.json({
                rawPrice: 0, liquidation75: 0, source: "no_pnu",
                message: "PNU(19자리)를 확인할 수 없습니다.",
            });
            return;
        }
        const year = (stdrYear && /^\d{4}$/.test(stdrYear))
            ? stdrYear
            : String(new Date().getFullYear());
        const result = await fetchOfficialPriceByPnu({
            apiUrl: VWORLD_PRICE_API.LAND,
            priceField: PRICE_FIELD.LAND,
            vworldKey,
            pnu: targetPnu,
            stdrYear: year,
        });
        if (!result) {
            res.json({
                rawPrice: 0, pnu: targetPnu, stdrYear: year, liquidation75: 0,
                source: "no_data",
                message: "해당 PNU/연도의 개별공시지가 데이터가 없습니다.",
            });
            return;
        }
        // 개별공시지가는 단가(원/㎡) — area가 있으면 총액 계산
        const unitPrice = result.rawPrice;
        const totalPrice = area && area > 0 ? unitPrice * area : unitPrice;
        res.json({
            rawPrice: totalPrice,
            unitPrice,
            area: area ?? 0,
            address: result.address || address || "",
            pnu: result.pnu,
            stdrYear: result.stdrYear,
            standardDate: result.standardDate,
            propertyType: "land",
            liquidation75: Math.floor(totalPrice * 0.75),
            source: "vworld",
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "개별공시지가 조회 실패" });
    }
}
// ──────────────────────────────────────────────
// [Phase B-2] 주소 → PNU(19자리) 변환
//   PNU 구조: {법정동코드 10자리} + {필지구분 1자리} + {본번 4자리} + {부번 4자리}
//   - 필지구분: 1=일반토지, 2=산
//   - 본번/부번: 지번. 예) "123-45" → 본번 0123, 부번 0045
//
//  옵션 1: 브이월드 지오코딩 API (VWORLD_API_KEY 필요, 더 정확)
//  옵션 2: 행안부 도로명주소 API (business.juso.go.kr) fallback
//
//  실패 시 null 리턴 — 호출자가 fallback 처리.
// ──────────────────────────────────────────────
/** 지번 문자열 "123-45" 또는 "산 12" 등을 파싱 */
function parseJibun(jibun) {
    const trimmed = jibun.trim();
    const mountain = /^산/.test(trimmed) || trimmed.includes("산 ");
    const cleaned = trimmed.replace(/^산\s*/, "").replace(/\s+/g, "");
    const m = cleaned.match(/^(\d+)(?:-(\d+))?/);
    if (!m)
        return { mountain, bun: "0000", ji: "0000" };
    const bun = m[1].padStart(4, "0");
    const ji = (m[2] ?? "0").padStart(4, "0");
    return { mountain, bun, ji };
}
/**
 * 주소 문자열 → PNU(19자리) 변환.
 * 실패 시 null.
 */
async function addressToPnu(address) {
    if (!address || address.trim().length < 5)
        return null;
    // 1) 브이월드 지오코딩 API (우선 시도)
    const vworldKey = process.env.VWORLD_API_KEY ?? "";
    if (vworldKey) {
        const pnu = await addressToPnuViaVworld(address, vworldKey);
        if (pnu)
            return pnu;
    }
    // 2) 도로명주소 API (fallback)
    const jusoKey = process.env.JUSO_API_KEY ?? "";
    if (jusoKey) {
        const pnu = await addressToPnuViaJuso(address, jusoKey);
        if (pnu)
            return pnu;
    }
    return null;
}
/** 브이월드 지오코딩 API */
async function addressToPnuViaVworld(address, apiKey) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        // 지번주소(PARCEL) 기준 조회 — PNU 추출용
        const params = new URLSearchParams({
            service: "address",
            request: "getcoord",
            version: "2.0",
            crs: "epsg:4326",
            address,
            refine: "true",
            simple: "false",
            format: "json",
            type: "PARCEL",
            key: apiKey,
        });
        const r = await fetch(`https://api.vworld.kr/req/address?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!r.ok)
            return null;
        const data = (await r.json());
        const resp = data?.response;
        if (resp?.status !== "OK")
            return null;
        // structure 에 법정동코드/지번 포함
        const struct = resp?.refined?.structure ?? {};
        const level4L = String(struct.level4L ?? ""); // 법정동 이름 (참고용)
        const level4LC = String(struct.level4LC ?? ""); // 최근 VWORLD 는 19자리 PNU 를 직접 리턴
        const detail = String(struct.detail ?? "");
        const level5 = String(struct.level5 ?? ""); // 지번 "123-45"
        void level4L;
        // 시나리오 A: VWORLD 가 19자리 PNU 를 직접 제공 (최근 응답 형식)
        if (level4LC.length === 19)
            return level4LC;
        // 시나리오 B: 구버전 — 10자리 법정동코드 + 지번 조립
        if (level4LC.length === 10) {
            const jibun = level5 || detail;
            if (!jibun)
                return null;
            const { mountain, bun, ji } = parseJibun(jibun);
            const filter = mountain ? "2" : "1";
            const pnu = `${level4LC}${filter}${bun}${ji}`;
            if (pnu.length === 19)
                return pnu;
        }
        return null;
    }
    catch {
        return null;
    }
}
/**
 * POST /public/address-to-pnu
 * body: { address: string }
 * 주소 → PNU(19자리) 변환 전용 엔드포인트 (프론트 즉시 확인용)
 */
async function handleAddressToPnu(req, res) {
    try {
        const { address } = (req.body ?? {});
        if (!address || !address.trim()) {
            res.status(400).json({ success: false, error: "주소가 필요합니다." });
            return;
        }
        const pnu = await addressToPnu(address.trim());
        if (!pnu) {
            res.json({
                success: false,
                pnu: null,
                address: address.trim(),
                message: "주소를 PNU로 변환할 수 없습니다. 지번주소(예: '서울 강남구 역삼동 737')를 사용해 보세요.",
            });
            return;
        }
        res.json({
            success: true,
            pnu,
            address: address.trim(),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message ?? "지오코딩 실패" });
    }
}
/** 도로명주소 API (행안부) — 법정동코드 추출 후 지번 파싱으로 PNU 조립 */
async function addressToPnuViaJuso(address, apiKey) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const params = new URLSearchParams({
            confmKey: apiKey,
            currentPage: "1",
            countPerPage: "1",
            keyword: address,
            resultType: "json",
        });
        const r = await fetch(`https://business.juso.go.kr/addrlink/addrLinkApi.do?${params}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!r.ok)
            return null;
        const data = (await r.json());
        const juso = data?.results?.juso?.[0];
        if (!juso)
            return null;
        const admCd = String(juso.admCd ?? ""); // 행정구역코드 10자리 (법정동코드 아님 — 근사)
        const lnbrMnnm = String(juso.lnbrMnnm ?? "0"); // 지번 본번
        const lnbrSlno = String(juso.lnbrSlno ?? "0"); // 지번 부번
        const mtYn = String(juso.mtYn ?? "N"); // 산 여부
        if (admCd.length !== 10)
            return null;
        const filter = mtYn === "Y" ? "2" : "1";
        const bun = lnbrMnnm.padStart(4, "0");
        const ji = lnbrSlno.padStart(4, "0");
        const pnu = `${admCd}${filter}${bun}${ji}`;
        if (pnu.length !== 19)
            return null;
        return pnu;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=publicDataProxy.js.map