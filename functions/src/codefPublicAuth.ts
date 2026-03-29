import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getToken, callCodef, encryptRSA } from "./codefProxy";

// ---------------------------------------------------------------------------
// 공공기관 기관코드 매핑
// ---------------------------------------------------------------------------
const PUBLIC_ORG_MAP: Record<string, { organization: string; businessType: string }> = {
  "홈택스":   { organization: "0003", businessType: "NT" },
  "건보공단": { organization: "0001", businessType: "PP" },
  "국민연금": { organization: "0002", businessType: "PP" },
  "정부24":   { organization: "0001", businessType: "MW" },
};

// ---------------------------------------------------------------------------
// POST /codef/public-auth/create
// 공공기관 ID/PW 기반 CODEF connectedId 생성
// ---------------------------------------------------------------------------
export async function handlePublicAuthCreate(req: Request, res: Response): Promise<void> {
  let password = "";

  try {
    const {
      organization,
      loginType,
      id,
      password: rawPassword,
      clientId,
      officeId,
    } = req.body as {
      organization: string;
      loginType: string;
      id: string;
      password: string;
      clientId: string;
      officeId: string;
    };

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
    const token = await getToken();

    // ── 2. 비밀번호 RSA 암호화 ──
    const encryptedPassword = encryptRSA(password);

    // 비밀번호 즉시 메모리에서 제거
    password = "";

    // ── 3. CODEF connectedId 생성 요청 ──
    const result = await callCodef(token, "/v1/account/create", {
      accountList: [
        {
          countryCode: "KR",
          businessType: orgInfo.businessType,
          clientType: "P",        // 개인
          organization: orgInfo.organization,
          loginType: loginType ?? "1",
          id,
          password: encryptedPassword,
        },
      ],
    });

    const codefResult = result as Record<string, any>;
    if (codefResult?.result?.code !== "CF-00000") {
      res.status(502).json({
        error: codefResult?.result?.message ?? "connectedId 생성 실패",
        code: codefResult?.result?.code,
      });
      return;
    }

    const connectedId: string = codefResult?.data?.connectedId ?? "";
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

    await clientRef.set(
      {
        publicConnectedIds: {
          [organization]: connectedId,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    res.json({ success: true, connectedId, organization });
  } catch (err: any) {
    // 에러 시에도 비밀번호 변수 제거
    password = "";
    res.status(500).json({ error: err.message ?? "공공기관 인증 connectedId 생성 실패" });
  }
}
