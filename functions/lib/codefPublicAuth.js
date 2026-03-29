"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePublicAuthCreate = handlePublicAuthCreate;
const admin = __importStar(require("firebase-admin"));
const codefProxy_1 = require("./codefProxy");
// ---------------------------------------------------------------------------
// 공공기관 기관코드 매핑
// ---------------------------------------------------------------------------
const PUBLIC_ORG_MAP = {
    "홈택스": { organization: "0003", businessType: "NT" },
    "건보공단": { organization: "0001", businessType: "PP" },
    "국민연금": { organization: "0002", businessType: "PP" },
    "정부24": { organization: "0001", businessType: "MW" },
};
// ---------------------------------------------------------------------------
// POST /codef/public-auth/create
// 공공기관 ID/PW 기반 CODEF connectedId 생성
// ---------------------------------------------------------------------------
async function handlePublicAuthCreate(req, res) {
    let password = "";
    try {
        const { organization, loginType, id, password: rawPassword, clientId, officeId, } = req.body;
        password = rawPassword ?? "";
        // ── 입력 검증 ──
        if (!organization || !id || !password || !clientId || !officeId) {
            res.status(400).json({ error: "organization, id, password, clientId, officeId는 필수입니다" });
            password = "";
            return;
        }
        const orgInfo = PUBLIC_ORG_MAP[organization];
        if (!orgInfo) {
            res.status(400).json({
                error: `지원하지 않는 기관입니다: ${organization}. 지원 기관: ${Object.keys(PUBLIC_ORG_MAP).join(", ")}`,
            });
            password = "";
            return;
        }
        // ── 1. CODEF OAuth 토큰 발급 ──
        const token = await (0, codefProxy_1.getToken)();
        // ── 2. 비밀번호 RSA 암호화 ──
        const encryptedPassword = (0, codefProxy_1.encryptRSA)(password);
        // 비밀번호 즉시 메모리에서 제거
        password = "";
        // ── 3. CODEF connectedId 생성 요청 ──
        const result = await (0, codefProxy_1.callCodef)(token, "/v1/account/create", {
            accountList: [
                {
                    countryCode: "KR",
                    businessType: orgInfo.businessType,
                    clientType: "P", // 개인
                    organization: orgInfo.organization,
                    loginType: loginType ?? "1",
                    id,
                    password: encryptedPassword,
                },
            ],
        });
        const codefResult = result;
        if (codefResult?.result?.code !== "CF-00000") {
            res.status(502).json({
                error: codefResult?.result?.message ?? "connectedId 생성 실패",
                code: codefResult?.result?.code,
            });
            return;
        }
        const connectedId = codefResult?.data?.connectedId ?? "";
        if (!connectedId) {
            res.status(502).json({ error: "CODEF 응답에 connectedId가 없습니다" });
            return;
        }
        // ── 4. Firestore에 connectedId 저장 ──
        const clientRef = admin
            .firestore()
            .collection("offices")
            .doc(officeId)
            .collection("clients")
            .doc(clientId);
        await clientRef.set({
            publicConnectedIds: {
                [organization]: connectedId,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        res.json({ success: true, connectedId, organization });
    }
    catch (err) {
        // 에러 시에도 비밀번호 변수 제거
        password = "";
        res.status(500).json({ error: err.message ?? "공공기관 인증 connectedId 생성 실패" });
    }
}
//# sourceMappingURL=codefPublicAuth.js.map