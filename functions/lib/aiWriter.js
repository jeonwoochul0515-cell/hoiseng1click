"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAiGenerate = handleAiGenerate;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const SYSTEM_PROMPTS = {
    debtHistory: `당신은 개인회생 신청서류 작성을 돕는 법률 문서 작성 보조입니다.
의뢰인이 제공한 키워드/메모를 바탕으로 법원에 제출할 "채무 발생 경위" 진술문을 작성하세요.

작성 규칙:
- 1인칭 시점 ("신청인은 ~" 또는 "채무자는 ~")
- 진솔하고 반성적인 어조, 과장 없이 사실 위주
- 시간순으로 구성 (최초 채무 발생 → 악화 과정 → 현재 상황)
- 300~500자 내외
- 법원 제출 문서에 적합한 격식체 사용
- 마지막에 변제 의지를 간단히 언급
- 추가 설명 없이 진술문만 출력`,
    propertyChanges: `당신은 개인회생 진술서 작성을 돕는 법률 문서 작성 보조입니다.
의뢰인이 제공한 키워드/메모를 바탕으로 "2년 이내 재산 변동 사유"를 작성하세요.

작성 규칙:
- 1인칭 시점
- 처분한 재산의 종류, 처분 시기, 금액, 사유를 구체적으로
- 처분 대금의 사용처를 명시
- 150~300자 내외
- 법원 제출 문서에 적합한 격식체
- 추가 설명 없이 진술문만 출력`,
    repayWillingness: `당신은 개인회생 진술서 작성을 돕는 법률 문서 작성 보조입니다.
의뢰인이 제공한 키워드/메모를 바탕으로 "변제 의지 및 향후 계획" 진술문을 작성하세요.

작성 규칙:
- 1인칭 시점
- 진심어린 반성과 변제 의지 표현
- 구체적인 생활 개선 계획 포함 (절약, 추가 수입 노력 등)
- 200~400자 내외
- 법원 제출 문서에 적합한 격식체
- 과도하게 감상적이지 않게, 실현 가능한 계획 위주
- 추가 설명 없이 진술문만 출력`,
    jobChange: `당신은 개인회생 진술서 작성을 돕는 법률 문서 작성 보조입니다.
의뢰인이 제공한 키워드/메모를 바탕으로 "직장 변동 사항"을 작성하세요.

작성 규칙:
- 1인칭 시점
- 이직/퇴직/재취업 시기, 이전/현재 직장명, 급여 변동을 구체적으로
- 100~200자 내외
- 법원 제출 문서에 적합한 격식체
- 추가 설명 없이 진술문만 출력`,
    priorApplication: `당신은 개인회생 진술서 작성을 돕는 법률 문서 작성 보조입니다.
의뢰인이 제공한 키워드/메모를 바탕으로 "기존 회생/파산 신청 기각·폐지 경위"를 작성하세요.

작성 규칙:
- 1인칭 시점
- 이전 신청 시기, 법원, 기각/폐지 사유를 구체적으로
- 이번 신청에서 개선한 점 언급
- 100~250자 내외
- 법원 제출 문서에 적합한 격식체
- 추가 설명 없이 진술문만 출력`,
    applicationReason: `당신은 개인회생 절차 개시 신청서의 "신청이유"를 작성하는 법률 문서 작성 보조입니다.
신청인의 채무·소득·가족·직업 정보를 바탕으로 법원에 제출할 "신청이유"를 작성하세요.

작성 규칙:
- 1인칭 시점 ("신청인은 ~")
- 4개 문단 구성:
  1) 채무 발생 경위 (시간 순, 사실 위주)
  2) 현재 경제 상황 (총 채무액, 월 소득, 생활 곤란 정도)
  3) 정상 변제 불가 사유 (소득 부족, 채권자 독촉 등)
  4) 개인회생을 통한 변제 의지
- 반성적이고 진솔한 어조
- 1500~2000자 내외 (전자소송 양식 2000자 상한 준수)
- 법원 제출 문서에 적합한 격식체
- 과장·감상 금지, 사실 위주
- 추가 설명 없이 진술문만 출력`,
};
async function handleAiGenerate(req, res) {
    try {
        const { field, keywords, context } = req.body;
        if (!field || !keywords?.trim()) {
            res.status(400).json({ error: "field와 keywords가 필요합니다" });
            return;
        }
        const systemPrompt = SYSTEM_PROMPTS[field];
        if (!systemPrompt) {
            res.status(400).json({ error: `잘못된 field: ${field}` });
            return;
        }
        let userPrompt = `다음 키워드/메모를 바탕으로 진술문을 작성해주세요:\n\n${keywords}`;
        if (context) {
            const parts = [];
            if (context.name)
                parts.push(`신청인: ${context.name}`);
            if (context.totalDebt)
                parts.push(`총 채무액: ${context.totalDebt.toLocaleString()}원`);
            if (context.debtCount)
                parts.push(`채권자 수: ${context.debtCount}건`);
            if (context.job)
                parts.push(`직업: ${context.job}`);
            if (context.income)
                parts.push(`월 소득: ${context.income.toLocaleString()}원`);
            if (context.family)
                parts.push(`가족 수: ${context.family}명`);
            if (parts.length) {
                userPrompt += `\n\n참고 정보:\n${parts.join("\n")}`;
            }
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        // API 키가 없으면 더미 응답 (테스트용)
        if (!apiKey) {
            const dummyTexts = {
                debtHistory: (kw) => `신청인은 ${kw.split(/[,، ]+/)[0] || "생활비 부족"}(으)로 인하여 채무가 발생하게 되었습니다. 처음에는 소액의 신용대출로 시작하였으나, 이후 수입이 감소하면서 기존 채무의 이자 납부조차 어려워졌고, 부득이하게 추가 대출을 받아 기존 채무를 상환하는 악순환에 빠지게 되었습니다. 현재 총 채무가 감당할 수 없는 수준에 이르러 정상적인 방법으로는 채무 변제가 불가능한 상황이 되었습니다. 신청인은 깊이 반성하고 있으며, 개인회생 절차를 통하여 성실히 변제할 것을 다짐합니다.`,
                propertyChanges: (kw) => `신청인은 ${kw || "채무 상환을 위해"} 부득이하게 보유 재산을 처분하였습니다. 처분 대금은 전액 채무 상환 및 생활비에 사용하였으며, 현재 특별히 은닉하거나 빼돌린 재산은 없습니다.`,
                repayWillingness: (kw) => `신청인은 ${kw.split(/[,، ]+/)[0] || "성실한 변제"}을(를) 통해 채무를 갚아나갈 것을 굳게 다짐합니다. 향후 불필요한 지출을 최대한 줄이고, 가능한 범위에서 추가 수입 확보를 위해 노력하겠습니다. 법원이 인가해 주시는 변제계획에 따라 매월 변제금을 성실히 납부하여, 채권자분들께 조금이라도 보답하고자 합니다. 다시는 과도한 채무를 부담하지 않도록 검소한 생활을 유지하겠습니다.`,
                jobChange: (kw) => `신청인은 ${kw || "직장 변동이 있었습니다"}. 이로 인해 일시적으로 수입이 감소하였으나, 현재는 안정적으로 근무하고 있어 변제계획에 따른 납부가 가능한 상황입니다.`,
                priorApplication: (kw) => `신청인은 ${kw || "이전에 개인회생을 신청한 사실이 있습니다"}. 당시에는 준비 부족으로 인하여 절차가 원활히 진행되지 못하였으나, 이번에는 충분한 준비를 마치고 성실히 절차에 임하고자 합니다.`,
                applicationReason: (kw) => `신청인은 ${kw || "생활비 부족 및 기존 채무 이자 부담 누적"}(으)로 인하여 현재 총 채무액이 감당할 수 없는 수준에 이르렀습니다.\n\n처음에는 소액의 신용대출로 시작하였으나, 수입 감소와 생활비 증가로 인해 기존 채무의 이자 납부조차 어려워졌고, 부득이하게 추가 대출을 받아 기존 채무를 상환하는 악순환에 빠지게 되었습니다.\n\n현재 신청인의 월 소득만으로는 최저 생계비를 유지하기도 어려운 상황이며, 정상적인 방법으로는 채무 변제가 불가능한 상태입니다. 채권자들의 지속적인 독촉과 압류로 인해 일상생활마저 위협받고 있습니다.\n\n이에 신청인은 깊이 반성하며, 개인회생 절차를 통하여 법원이 인가하는 변제계획에 따라 성실히 채무를 변제하고자 본 신청에 이르게 되었습니다.`,
            };
            const text = dummyTexts[field]?.(keywords) ?? `${keywords}에 대한 진술문입니다.`;
            res.json({ text });
            return;
        }
        const client = new sdk_1.default({ apiKey });
        const message = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
        });
        console.log("Claude response:", JSON.stringify({
            stop_reason: message.stop_reason,
            usage: message.usage,
            content_types: message.content.map((b) => b.type),
        }));
        // 모든 text 블록을 합침
        const textParts = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text);
        const text = textParts.join("\n").trim();
        if (!text) {
            res.status(500).json({
                error: "AI 응답이 비어있습니다",
                debug: { stop_reason: message.stop_reason, content_types: message.content.map((b) => b.type) },
            });
            return;
        }
        res.json({ text, stop_reason: message.stop_reason });
    }
    catch (err) {
        console.error("AI 생성 실패:", err);
        res.status(500).json({ error: err.message ?? "AI 생성 실패" });
    }
}
//# sourceMappingURL=aiWriter.js.map