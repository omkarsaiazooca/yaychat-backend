// routes/ai.routes.ts
import { Router, Request, Response } from "express";
import { callHuggingFaceModel } from "../helpers/callHuggingFaceModel";
import { AskAIRequest, AskAIResponse } from "../data/aiAsk";
import { InvestmentOperations } from "../platform/investment.operations";
import { getMixed24hFeed } from "../controllers/marketFeed.controller";
import { MarketNewController } from "../controllers/marketNewsAPI";

const aiRouter: Router = Router();
const basic = new MarketNewController();

/** -------------------
 *  AI Assistant Route
 * ------------------- */
aiRouter.post("/ask-ai", async (req: Request, res: Response) => {
  try {
    const body = req.body as AskAIRequest;
    const { question, context, client } = body;

    const prompt = `
You are a financial assistant. 
User question: ${question}
Context: ${JSON.stringify(context)}
Client Info: ${JSON.stringify(client)}
Provide clear, structured advice (educational only, not financial advice).
`;

    const aiText = await callHuggingFaceModel(prompt);

    const response: AskAIResponse = {
      question,
      meta: { context, client },
      summary: aiText,
      bullets: aiText.split(". ").map(s => s.trim()).filter(Boolean),
      chips: [
        { label: "Low Risk", tone: "info" },
        { label: "Medium Risk", tone: "warning" },
        { label: "High Risk", tone: "danger" },
      ],
      next_action: {
        product: "investment_plan",
        suggested: {
          amount: context?.amount ?? 100,
          risk: context?.risk ?? 2,
          duration: { value: 6, unit: "months" },
        },
      },
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("AI API error:", err?.message || err);
    return res.status(500).json({ error: "AI service failed" });
  }
});

/** -------------------
 *  Investment Routes
 * ------------------- */
// create
aiRouter.post("/investments", (req, res) =>
  new InvestmentOperations(req, res).createInvestment(req, res)
);

// sell (use a clear path)
aiRouter.post("/investments/sell", (req, res) =>
  new InvestmentOperations(req, res).sellInvestment(req, res)
);

// fetch by userId
aiRouter.get("/investments/user/:userId", (req, res) =>
  new InvestmentOperations(req, res).getInvestmentsByUser(req, res)
);

aiRouter.get("/investments/email/:email", (req, res) =>
  new InvestmentOperations(req, res).getInvestmentsByEmail(req, res)
);

aiRouter.get("/investment-new/email/:email", (req, res) =>
  new InvestmentOperations(req, res).getInvestmentsByEmailNew(req, res)
);

aiRouter.get("/investments-new/email/:email", (req, res) =>
  new InvestmentOperations(req, res).getInvestmentsByEmailNewOne(req, res)
);


aiRouter.get("/investments/:id", (req, res) =>
  new InvestmentOperations(req, res).getInvestmentById(req, res)
);

aiRouter.put("/investments/:id", (req, res) =>
  new InvestmentOperations(req, res).updateInvestment(req, res)
);

aiRouter.delete("/investments/:id", (req, res) =>
  new InvestmentOperations(req, res).deleteInvestment(req, res)
);

aiRouter.get("/portfolio-summary/:email", (req, res) =>
  new InvestmentOperations(req, res).getPortfolioSummary(req, res)
);

// market feeds and news
aiRouter.get("/marketFeeds", getMixed24hFeed);
aiRouter.get("/marketNews", basic.getMarketNews.bind(basic));

export const aiInvestmentRoute = aiRouter;
