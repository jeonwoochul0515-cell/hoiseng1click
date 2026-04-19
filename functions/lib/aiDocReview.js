"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAiDocReview = handleAiDocReview;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const REVIEW_SYSTEM_PROMPT = `당신은 한국 개인회생 신청서류를 검증하는 법률 문서 검수 보조입니다.
법원 제출 전 논리적 오류, 누락 항목, 법적 리스크를 찾아 JSON 형식으로만 응답하세요.

검증 영역:
1. 채권자목록: 중복/누락/금액 0원/이자율 비정상(>30%)/채권자 불명확
2. 재산목록: 환가율 0%/음수/담보채권 > 자산가액/명의 불일치
3. 수입지출목록: 소득 대비 지출 비율/생계비 기준 초과/가구원수 불일치
4. 변제계획안: 월변제금 < 0/기간 36~60개월 외/청산가치 미충족
5. 진술서: 시간순 모순/숫자 불일치(서류 간)/불법 행위 자백 요소
6. 법원 제출 형식: 필수 필드 누락, 날짜 포맷, 서명 누락

응답 형식 (순수 JSON만, 마크다운 금지):
{
  "score": 85,
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "채권자목록|재산목록|수입지출|변제계획|진술서|형식",
      "field": "선택적 — 문제 필드명",
      "message": "간결한 문제 설명",
      "suggestion": "구체적 수정 제안"
    }
  ],
  "submittable": false,
  "summary": "전체 검토 요약 1~2문장"
}

점수 기준: critical 1건당 -20점, warning 1건당 -5점, info는 감점 없음.`;
async function handleAiDocReview(req, res) {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: "AI 서비스가 설정되지 않았습니다" });
            return;
        }
        const body = req.body;
        if (!body.documents || typeof body.documents !== "object") {
            res.status(400).json({ error: "documents 필드가 필요합니다" });
            return;
        }
        // payload 크기 상한 (50KB)
        const payload = JSON.stringify(body.documents);
        if (payload.length > 50_000) {
            res.status(413).json({ error: "서류 데이터가 너무 큽니다 (50KB 초과)" });
            return;
        }
        const client = new sdk_1.default({ apiKey });
        const userContent = `다음 개인회생 신청 서류를 검증하고 JSON 리포트만 반환하세요:\n\n${payload}`;
        const message = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 2048,
            system: REVIEW_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userContent }],
        });
        const text = message.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("")
            .trim();
        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        }
        catch {
            res.status(502).json({ error: "AI 응답을 파싱할 수 없습니다", raw: text.slice(0, 500) });
            return;
        }
        const report = {
            score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 0,
            issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 50) : [],
            submittable: parsed.submittable === true,
            summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
            model: "claude-opus-4-7",
            generatedAt: new Date().toISOString(),
        };
        res.json(report);
    }
    catch (err) {
        console.error("[AI_REVIEW] 예외:", err.message);
        res.status(500).json({ error: "AI 검증 중 오류가 발생했습니다" });
    }
}
//# sourceMappingURL=aiDocReview.js.map