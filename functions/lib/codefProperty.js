"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVehicleInfo = handleVehicleInfo;
exports.handlePropertyPrice = handlePropertyPrice;
exports.handleAssetLookup = handleAssetLookup;
// ---------------------------------------------------------------------------
// CODEF OAuth & 호출 헬퍼
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";
function getCodefBase() {
    return process.env.CODEF_API_HOST || "https://api.codef.io";
}
let cachedToken = null;
async function getToken() {
    if (cachedToken && cachedToken.expiry > Date.now())
        return cachedToken.token;
    const clientId = process.env.CODEF_CLIENT_ID ?? "";
    const clientSecret = process.env.CODEF_CLIENT_SECRET ?? "";
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(OAUTH_URL, {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials&scope=read",
    });
    if (!res.ok) {
        throw new Error(`CODEF OAuth failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json());
    if (!data.access_token) {
        throw new Error("CODEF OAuth response missing access_token");
    }
    cachedToken = { token: data.access_token, expiry: Date.now() + 6 * 24 * 60 * 60 * 1000 };
    return cachedToken.token;
}
async function callCodef(token, endpoint, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const jsonBody = JSON.stringify(body);
    try {
        const res = await fetch(`${getCodefBase()}${endpoint}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: jsonBody,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await res.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return JSON.parse(decodeURIComponent(text.replace(/\+/g, " ")));
        }
    }
    catch (err) {
        clearTimeout(timeout);
        throw new Error(`CODEF API error on ${endpoint}: ${err instanceof Error ? err.message : "호출 실패"}`);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 1. 차량등록원부 + 시세 조회
// ═══════════════════════════════════════════════════════════════════════════
/**
 * POST /codef/vehicle-info
 * body: { carNumber: string, ownerName?: string, ownerBirthDate?: string }
 *
 * CODEF 차량 제원·시세 API를 통해 차량 정보 + 보험개발원 기준가액 조회
 * + 차량등록원부에서 저당/압류 정보 조회
 */
async function handleVehicleInfo(req, res) {
    try {
        const { carNumber, ownerName, ownerBirthDate } = req.body;
        if (!carNumber) {
            res.status(400).json({ error: "차량번호가 필요합니다" });
            return;
        }
        const token = await getToken();
        // 병렬 호출: 차량 제원·시세 + 차량등록원부
        const [specResult, regResult] = await Promise.allSettled([
            callCodef(token, "/v1/kr/public/pp/car-spec-price", {
                organization: "0001",
                carNo: carNumber,
            }),
            callCodef(token, "/v1/kr/public/pp/car-registration-info", {
                organization: "0001",
                carNo: carNumber,
                identity: ownerBirthDate ?? "",
                userName: ownerName ?? "",
            }),
        ]);
        const specData = specResult.status === "fulfilled" ? specResult.value : null;
        const regData = regResult.status === "fulfilled" ? regResult.value : null;
        // 제원·시세 파싱
        const spec = specData?.data ?? {};
        const model = spec.resCarModel ?? spec.resModelName ?? "";
        const year = Number(spec.resYear ?? spec.resModelYear ?? new Date().getFullYear());
        const displacement = Number(spec.resDisplacement ?? 0);
        const fuelType = spec.resFuelType ?? "";
        const basePrice = Number(spec.resBasePrice ?? spec.resCarPrice ?? 0);
        const insurancePrice = Number(spec.resInsurancePrice ?? spec.resStandardPrice ?? basePrice);
        // 등록원부 파싱 — 저당/압류
        const regInfo = regData?.data ?? {};
        const mortgageList = regInfo.resMortgageList ?? [];
        const seizureList = regInfo.resSeizureList ?? [];
        const totalMortgage = mortgageList.reduce((sum, m) => sum + Number(m.resAmount ?? m.resMortgageAmount ?? 0), 0);
        const totalSeizure = seizureList.reduce((sum, s) => sum + Number(s.resAmount ?? s.resSeizureAmount ?? 0), 0);
        const liquidation70 = Math.floor(insurancePrice * 0.70);
        const netValue = Math.max(0, liquidation70 - totalMortgage - totalSeizure);
        res.json({
            carNumber,
            model,
            year,
            displacement,
            fuelType,
            basePrice: insurancePrice,
            liquidation70,
            mortgage: totalMortgage,
            seizure: totalSeizure,
            netValue,
            mortgageDetails: mortgageList,
            seizureDetails: seizureList,
            registrationDate: regInfo.resRegistrationDate ?? "",
            ownerCount: Number(regInfo.resOwnerCount ?? 0),
            source: specData ? "codef" : "codef_partial",
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "차량 정보 조회 실패" });
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 2. 부동산 공시가격 조회 (CODEF 경유)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * POST /codef/property-price
 * body: { address: string, propertyType?: 'apt'|'house'|'land', dong?: string, ho?: string }
 *
 * CODEF 부동산 공시가격 알리미 API를 통해 공시가격 조회
 */
async function handlePropertyPrice(req, res) {
    try {
        const { address, propertyType, dong, ho } = req.body;
        if (!address) {
            res.status(400).json({ error: "주소가 필요합니다" });
            return;
        }
        const token = await getToken();
        const type = propertyType ?? "apt";
        let endpoint;
        let reqBody;
        switch (type) {
            case "apt":
                // 공동주택(아파트) 공시가격
                endpoint = "/v1/kr/public/pp/reb-estate-apartment-price";
                reqBody = {
                    organization: "0001",
                    address,
                    dong: dong ?? "",
                    ho: ho ?? "",
                };
                break;
            case "house":
                // 개별주택 공시가격
                endpoint = "/v1/kr/public/pp/reb-estate-individual-housing-price";
                reqBody = {
                    organization: "0001",
                    address,
                };
                break;
            case "land":
            default:
                // 개별공시지가
                endpoint = "/v1/kr/public/pp/reb-estate-individual-land-price";
                reqBody = {
                    organization: "0001",
                    address,
                };
                break;
        }
        const result = await callCodef(token, endpoint, reqBody);
        const data = result?.data ?? {};
        const rawPrice = Number(data.resOfficialPrice ?? data.resPblntfPrice ?? data.resPrice ?? 0);
        const area = Number(data.resArea ?? data.resExclusiveArea ?? 0);
        const stdDate = data.resStandardDate ?? data.resBaseDate ?? "";
        if (rawPrice <= 0) {
            // CODEF에서 결과 없으면 에러 대신 빈 결과
            res.json({
                address,
                propertyType: type,
                rawPrice: 0,
                liquidation75: 0,
                source: "codef_no_data",
                message: "해당 주소의 공시가격 정보를 찾을 수 없습니다. 수동 입력해주세요.",
            });
            return;
        }
        res.json({
            address,
            propertyType: type,
            rawPrice,
            area,
            liquidation75: Math.floor(rawPrice * 0.75),
            standardDate: stdDate,
            buildingName: data.resBuildingName ?? data.resAptName ?? "",
            dongHo: data.resDong && data.resHo ? `${data.resDong}동 ${data.resHo}호` : "",
            source: "codef",
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "부동산 공시가격 조회 실패" });
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 3. 통합 재산 조회 (차량 + 부동산 한번에)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * POST /codef/asset-lookup
 * body: {
 *   vehicles: [{ carNumber, ownerName?, ownerBirthDate? }],
 *   properties: [{ address, propertyType?, dong?, ho? }],
 * }
 */
async function handleAssetLookup(req, res) {
    try {
        const { vehicles, properties } = req.body;
        const token = await getToken();
        // 차량 조회 병렬 실행
        const vehiclePromises = (vehicles ?? []).map(async (v) => {
            try {
                const [specResult, regResult] = await Promise.allSettled([
                    callCodef(token, "/v1/kr/public/pp/car-spec-price", {
                        organization: "0001", carNo: v.carNumber,
                    }),
                    callCodef(token, "/v1/kr/public/pp/car-registration-info", {
                        organization: "0001", carNo: v.carNumber,
                        identity: v.ownerBirthDate ?? "", userName: v.ownerName ?? "",
                    }),
                ]);
                const spec = (specResult.status === "fulfilled" ? specResult.value : {})?.data ?? {};
                const reg = (regResult.status === "fulfilled" ? regResult.value : {})?.data ?? {};
                const insurancePrice = Number(spec.resInsurancePrice ?? spec.resStandardPrice ?? spec.resCarPrice ?? 0);
                const mortgageList = reg.resMortgageList ?? [];
                const seizureList = reg.resSeizureList ?? [];
                const totalMortgage = mortgageList.reduce((s, m) => s + Number(m.resAmount ?? m.resMortgageAmount ?? 0), 0);
                const totalSeizure = seizureList.reduce((s, m) => s + Number(m.resAmount ?? m.resSeizureAmount ?? 0), 0);
                const liq70 = Math.floor(insurancePrice * 0.70);
                return {
                    carNumber: v.carNumber,
                    model: spec.resCarModel ?? spec.resModelName ?? "",
                    year: Number(spec.resYear ?? spec.resModelYear ?? 0),
                    basePrice: insurancePrice,
                    liquidation70: liq70,
                    mortgage: totalMortgage,
                    seizure: totalSeizure,
                    netValue: Math.max(0, liq70 - totalMortgage - totalSeizure),
                    source: "codef",
                };
            }
            catch (err) {
                return { carNumber: v.carNumber, error: err.message, source: "error" };
            }
        });
        // 부동산 조회 병렬 실행
        const propertyPromises = (properties ?? []).map(async (p) => {
            const type = p.propertyType ?? "apt";
            let endpoint;
            let reqBody;
            switch (type) {
                case "apt":
                    endpoint = "/v1/kr/public/pp/reb-estate-apartment-price";
                    reqBody = { organization: "0001", address: p.address, dong: p.dong ?? "", ho: p.ho ?? "" };
                    break;
                case "house":
                    endpoint = "/v1/kr/public/pp/reb-estate-individual-housing-price";
                    reqBody = { organization: "0001", address: p.address };
                    break;
                default:
                    endpoint = "/v1/kr/public/pp/reb-estate-individual-land-price";
                    reqBody = { organization: "0001", address: p.address };
                    break;
            }
            try {
                const result = await callCodef(token, endpoint, reqBody);
                const data = result?.data ?? {};
                const rawPrice = Number(data.resOfficialPrice ?? data.resPblntfPrice ?? data.resPrice ?? 0);
                return {
                    address: p.address,
                    propertyType: type,
                    rawPrice,
                    liquidation75: Math.floor(rawPrice * 0.75),
                    buildingName: data.resBuildingName ?? data.resAptName ?? "",
                    source: rawPrice > 0 ? "codef" : "codef_no_data",
                };
            }
            catch (err) {
                return { address: p.address, error: err.message, source: "error" };
            }
        });
        const [vehicleResults, propertyResults] = await Promise.all([
            Promise.all(vehiclePromises),
            Promise.all(propertyPromises),
        ]);
        res.json({ vehicles: vehicleResults, properties: propertyResults });
    }
    catch (err) {
        res.status(500).json({ error: err.message ?? "재산 조회 실패" });
    }
}
//# sourceMappingURL=codefProperty.js.map