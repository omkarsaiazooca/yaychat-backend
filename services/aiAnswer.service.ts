import { AiAnswer } from "../data/aiAnswer";
import { ServiceBase } from "./base";
import aiAnswerSchema, { AiAnswerModel } from "../models/aiAsk";
import { AskAIRequest, AskAIResponse } from "../data/aiAsk";
import { callHuggingFaceModel } from "../helpers/callHuggingFaceModel";

export class AiAnswerService extends ServiceBase<AiAnswer, AiAnswerModel> {
    constructor() {
        super(aiAnswerSchema, "AiAnswer");
    }

    async ask(payload: AskAIRequest): Promise<AskAIResponse> {
        const aiText = await callHuggingFaceModel(payload.question);

        const response: AskAIResponse = {
            question: payload.question,
            meta: { ...payload.context, latency_ms: 100 },
            summary: aiText || "No answer generated.",
            bullets: [
                "Smart Mix → Balanced & diversified",
                "Smart Crypto → High-risk, high-reward",
                "Smart Treasury → Stability first"
            ],
            chips: [
                { label: "High Risk, High Return", tone: "warning" },
                { label: "Smart Crypto", tone: "neutral" },
                { label: "Safe & Steady", tone: "neutral" }
            ],
            next_action: {
                product: payload.context.tab || "Smart Mix",
                suggested: {
                    amount: payload.context.amount || 100,
                    risk: payload.context.risk || 3,
                    duration: { value: 1, unit: "Month" }
                }
            }
        };

        // save request + response in DB
        await this.create({ ...response, request: payload });

        return response;
    }

    async latest(limit = 10): Promise<AiAnswer[]> {
        return this.findSelect({}, { createdAt: -1 });
    }
}
