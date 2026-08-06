import { Request, Response } from "express";
import axios from "axios";
import { Investment } from "../data/aiInvestment";
import { InvestmentService } from "../services/aiInvestment.service";
import { allNewTokens } from "../helpers/allNewTokens";
import { BaseAPIOperations } from "./base.operations";
import { StockService } from "../services/stock.service";
import { pickByNumericRisk, SelectionType } from "../helpers/riskPicker";
import { ensureRedisConnected } from "../cache/redisClient";
import { toPlain } from "../helpers/mongooseHelper";

const investmentService: InvestmentService = new InvestmentService();
type MixLeg = { symbol: string; weight: number }; // weight 0..100

const SUMMARY_TTL_SEC = 60 * 10; // 10 minutes
export class InvestmentOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  private async getPrice(
    asset?: string,
    type?: SelectionType,                  // "smart-mix" | "crypto" | "stock"
    basket?: MixLeg[]                      // when smart-mix
  ): Promise<number> {
    // helper: normalize symbols
    const normalize = (s: string) => {
      const up = s.trim().toUpperCase();
      if (up === "APPL") return "AAPL";
      if (up === "TLSA") return "TSLA";
      if (up === "SNP500") return "SPX";
      // crypto: "BTC/USD" -> "BTC"
      const m = up.match(/^([A-Z0-9]+)\/USD$/);
      return m ? m[1] : up;
    };

    // single price fetch (used by both single and mix legs)
    const fetchSingle = async (symRaw: string): Promise<number> => {
      const sym = normalize(symRaw);

      // is this symbol a stock from your token list?
      const token = allNewTokens.find((t: any) => String(t.title).toUpperCase() === sym);
      const isStock = token?.isStock ?? ["AAPL", "AMZN", "TSLA", "MSFT", "NVDA", "META", "GOOGL", "PEP", "SPX", "AVGO"].includes(sym);

      if (isStock) {
        // handle SPX proxy if your StockService doesn't support it
        const stockSym = sym === "SPX" ? "SPX" : sym;
        return await new StockService().fetchStockPrice(stockSym);
      }

      // crypto via Binance USDT pairs
      try {
        const binanceSymbol = `${sym}USDT`;   // e.g., BTC -> BTCUSDT, ETH -> ETHUSDT
        const resp = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`
        );
        return parseFloat(resp.data.price);
      } catch {
        // fallback mock
        return 100 + Math.random() * 500;
      }
    };

    // 1) smart-mix (weighted blend)
    if (type === "smart-mix" && Array.isArray(basket) && basket.length) {
      // normalize weights to sum=1
      const total = basket.reduce((s, l) => s + (l.weight || 0), 0) || 100;
      let sum = 0;
      for (const leg of basket) {
        const p = await fetchSingle(leg.symbol);
        sum += p * ((leg.weight || 0) / total);
      }
      return sum;
    }

    // 2) single asset
    if (asset) {
      return await fetchSingle(asset);
    }

    return 0;
  }

  async createInvestment(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const type = String(body.type || "").toLowerCase() as SelectionType;
      const riskScore = Number(body.riskLevel ?? body.riskScore);

      const seed =
        (body.userId?.toString?.() ?? "") ||
        (body.user?.id?.toString?.() ?? "") ||
        (body.user?.email ?? "") ||
        (body.user?.phone ?? "") ||
        "";

      let asset: string | undefined = body.asset;
      let basket: MixLeg[] | undefined;

      if (!asset) {
        if (!["crypto", "stock", "smart-mix"].includes(type)) {
          return res.status(400).json({ ok: false, error: "Missing/invalid type (crypto | stock | smart-mix)" });
        }
        if (!Number.isFinite(riskScore) || riskScore < 1 || riskScore > 9) {
          return res.status(400).json({ ok: false, error: "Missing/invalid riskLevel (1..9)" });
        }

        const pick = pickByNumericRisk({ type, riskScore, seed, allTokens: allNewTokens });
        if (pick.kind === "single") {
          asset = pick.symbol;
        } else {
          basket = pick.allocations;
          const main = [...basket].sort((a, b) => b.weight - a.weight)[0];
          asset = main.symbol;
        }
      }

      const price = await this.getPrice(asset!, type, basket);

      const investment: Investment = {
        ...body,
        asset,
        basket,
        type,
        riskLevel: riskScore,
        simulatedPrice: price,
        side: "buy" as any,
        status: "executed",
      } as any;

      const saved = await investmentService.createInvestment(investment);
      return res.status(200).json({ ok: true, data: saved });
    } catch (err: any) {
      console.error("createInvestment error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error creating investment" });
    }
  }

  async sellInvestment(req: Request, res: Response) {
    try {
      const { investmentId, email, amount, percent, asset } = req.body ?? {};

      // Preferred path: sell existing investment by id
      const id = investmentId ? String(investmentId) : "";
      if (id && email) {
        const saved = await investmentService.sellInvestment({
          investmentId: id,
          email: String(email),
          amount: amount != null ? Number(amount) : undefined,
          percent: percent != null ? Number(percent) : undefined,
        });
        return res.status(200).json({ ok: true, data: saved });
      }

      // Fallback: direct asset sell
      if (!email) return res.status(400).json({ ok: false, error: "email required" });
      if (!asset) return res.status(400).json({ ok: false, error: "asset required" });
      if (amount === undefined || Number(amount) <= 0) {
        return res.status(400).json({ ok: false, error: "amount (asset qty) must be > 0" });
      }

      const saved = await investmentService.sellInvestment({
        email: String(email),
        asset: String(asset),
        amount: Number(amount),
      } as any);

      return res.status(200).json({ ok: true, data: saved });
    } catch (err: any) {
      console.error("sellInvestment error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error selling investment" });
    }
  }


  async getInvestmentsByUser(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      const results = await investmentService.getInvestmentsByUser(userId);
      return res.status(200).json({ ok: true, data: results });
    } catch (err: any) {
      console.error("getInvestmentsByUser error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error fetching investments" });
    }
  }

  async getInvestmentsByEmail(req: Request, res: Response) {
    try {
      const email = req.params.email;
      const results = await investmentService.getInvestmentsByEmail(email);
      return res.status(200).json({ ok: true, data: results });
    } catch (err: any) {
      console.error("getInvestmentsByEmail error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error fetching investments" });
    }
  }

  async getInvestmentsByEmailNew(req: Request, res: Response) {
    try {
      const email = String(req.params.email).toLowerCase();
      const investments = await investmentService.getInvestmentsByEmail(email);

      // Guard: nothing to do
      if (!investments?.length) {
        return res.status(200).json({ ok: true, data: [] });
      }

      // --- 1) Build per-symbol timeline (FIFO basis) ---
      // Normalize a symbol in the same way as InvestmentService
      const normalize = (s: string) => {
        const up = (s || "").trim().toUpperCase();
        if (up === "APPL") return "AAPL";
        if (up === "TLSA") return "TSLA";
        if (up === "SNP500") return "SPX";
        const m = up.match(/^([A-Z0-9]+)\/USD$/);
        return m ? m[1] : up;
      };

      // Clone to avoid mutating originals
      const rows = investments
        .map(inv => ({ ...inv }))
        .filter(inv => inv.status !== "failed");

      // Attach helper fields we'll compute
      for (const r of rows) {
        (r as any).__remainingQty = Number(r.amount || 0); // will be reduced by FIFO if sells consume it
        (r as any).__realizedPnlUsd = 0;
        (r as any).__unrealizedPnlUsd = 0;
        (r as any).__currentPrice = 0;
        (r as any).__currentValueUsd = 0;
        (r as any).__normSym = r.asset ? normalize(r.asset) : undefined;
        (r as any).__timestamp = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      }

      // Group by symbol
      const bySymbol: Record<string, any[]> = {};
      for (const r of rows) {
        const sym = r.__normSym || (r.asset ? normalize(r.asset) : "");
        if (!sym) continue;
        bySymbol[sym] ??= [];
        bySymbol[sym].push(r);
      }
      // Sort chronologically for FIFO
      for (const s of Object.keys(bySymbol)) {
        bySymbol[s].sort((a, b) => a.__timestamp - b.__timestamp);
      }

      // --- 2) Live prices: smart-mix per row; everything else batched-ish ---
      // For single-asset rows, fetch unique symbols' live prices via InvestmentService.fetchSinglePrice
      const singleSymbols = new Set<string>();
      for (const r of rows) {
        if (r.type !== "smart-mix" && r.__normSym) singleSymbols.add(r.__normSym);
      }

      const singlePx: Record<string, number> = {};
      for (const sym of singleSymbols) {
        // Using private method through bracket access if needed
        // @ts-ignore
        const px = await investmentService["fetchSinglePrice"](sym);
        singlePx[sym] = px;
      }

      // For smart-mix rows, compute blended price with existing helper
      const smartMixPriceCache = new Map<string, number>(); // key by investmentId to avoid recompute
      const priceForRow = async (r: any): Promise<number> => {
        if (r.type === "smart-mix") {
          const key = r.investmentId || `${r.__normSym}-${r.__timestamp}`;
          if (smartMixPriceCache.has(key)) return smartMixPriceCache.get(key)!;
          // @ts-ignore
          const px = await this.getPrice(r.asset!, "smart-mix", r.basket);
          smartMixPriceCache.set(key, px);
          return px;
        }
        return singlePx[r.__normSym] ?? 0;
      };

      // --- 3) FIFO matching to compute realized PnL and remainingQty ---
      // For each symbol, walk buys/sells; attribute realized PnL to sells and also to the buys they consume.
      for (const [symbol, list] of Object.entries(bySymbol)) {
        // FIFO lots from buy rows only
        const lots: Array<{ row: any; qtyLeft: number; cpu: number }> = [];

        // Helper to compute cost per unit for a buy row (including optional fees)
        const cpuOfBuy = (row: any) => {
          const qty = Number(row.amount || 0);
          const costUsd = Number(row.usdAmount || (row.priceAtExecution || 0) * qty);
          const fee = Number(row.feesUsd || 0);
          return qty > 0 ? (costUsd + fee) / qty : 0;
        };

        for (const r of list) {
          const side = r.side || "buy";

          if (side === "buy") {
            const cpu = cpuOfBuy(r);
            lots.push({ row: r, qtyLeft: Number(r.amount || 0), cpu });
            continue;
          }

          // Sell: realize PnL against FIFO lots
          const sellQty = Math.max(0, Number(r.amount || 0));
          if (!sellQty) continue;

          // Proceeds for the sell (prefer usdAmount; fallback to exec px * qty)
          const sellExecPx = Number(r.priceAtExecution || 0);
          const proceedsUsd = Number(r.usdAmount || sellExecPx * sellQty);
          const sellFee = Number(r.feesUsd || 0);
          const netProceeds = proceedsUsd - sellFee;
          const unitProceeds = sellQty > 0 ? netProceeds / sellQty : 0;

          let remaining = sellQty;
          let realizedForThisSell = 0;

          while (remaining > 1e-12 && lots.length) {
            const lot = lots[0];
            const take = Math.min(remaining, lot.qtyLeft);

            const saleUsd = unitProceeds * take;
            const costUsd = lot.cpu * take;
            const realizedPiece = saleUsd - costUsd;

            realizedForThisSell += realizedPiece;

            // attribute realized to the buy row as well
            lot.row.__realizedPnlUsd += realizedPiece;

            lot.qtyLeft -= take;
            lot.row.__remainingQty = +(lot.qtyLeft.toFixed(8));
            remaining -= take;

            if (lot.qtyLeft <= 1e-12) {
              lots.shift();
            }
          }

          // If selling more than held, we’ll assume zero-cost short close (realized = 0) for the overflow
          r.__realizedPnlUsd += realizedForThisSell;
        }

        // After sells, compute unrealized on remaining qty of each buy lot at live price
        const livePx = singlePx[symbol] ?? 0; // smart-mix not in this bucket
        for (const lot of lots) {
          if (lot.qtyLeft > 1e-12) {
            const unreal = (livePx - lot.cpu) * lot.qtyLeft;
            lot.row.__unrealizedPnlUsd += unreal;
            lot.row.__remainingQty = +lot.qtyLeft.toFixed(8);
          }
        }
      }

      // --- 4) Attach live price & current value to each row; complete metrics ---
      for (const r of rows) {
        const live = await priceForRow(r);
        r.__currentPrice = live;

        // current value uses remainingQty for buys; sells have no open exposure
        const openQty = (r.side || "buy") === "buy" ? Number(r.__remainingQty || 0) : 0;
        r.__currentValueUsd = +(openQty * live).toFixed(2);

        // If row is a pure buy and never sold, unrealized also equals (live - exec) * qty
        // but we’ve already computed accurate FIFO-based value above.

        const totalPnl = Number(r.__realizedPnlUsd) + Number(r.__unrealizedPnlUsd);

        // Cost basis for this row to get pct:
        //  - For buys: basis = cpu * remainingQty + (sold part basis already realized)
        //    For a per-row % that reflects the whole row, we can use initial notional:
        const initialNotional =
          (r.side || "buy") === "buy"
            ? Number(r.usdAmount || (r.priceAtExecution || 0) * Number(r.amount || 0))
            : Number(r.usdAmount || (r.priceAtExecution || 0) * Number(r.amount || 0)); // for sells, pct is on proceeds

        const pnlPct = initialNotional > 0 ? +(100 * (totalPnl / initialNotional)).toFixed(2) : 0;

        // Shape the response fields
        (r as any).currentPrice = +live.toFixed(8);
        (r as any).remainingQty = +openQty.toFixed(8);
        (r as any).currentValueUsd = r.__currentValueUsd;
        (r as any).realizedPnlUsd = +Number(r.__realizedPnlUsd).toFixed(2);
        (r as any).unrealizedPnlUsd = +Number(r.__unrealizedPnlUsd).toFixed(2);
        (r as any).totalPnlUsd = +Number(totalPnl).toFixed(2);
        (r as any).pnlPct = pnlPct;

        // Cleanup internals
        delete (r as any).__remainingQty;
        delete (r as any).__realizedPnlUsd;
        delete (r as any).__unrealizedPnlUsd;
        delete (r as any).__currentPrice;
        delete (r as any).__currentValueUsd;
        delete (r as any).__normSym;
        delete (r as any).__timestamp;
      }

      return res.status(200).json({ ok: true, data: rows });
    } catch (err: any) {
      console.error("getInvestmentsByEmail error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error fetching investments" });
    }
  }

  async getInvestmentsByEmailNewOne(req: Request, res: Response) {
    try {
      const email = String(req.params.email).toLowerCase();

      // 1) fetch and convert to plain objects (no lean)
      const docs = await investmentService.getInvestmentsByEmail(email);
      const rows = docs.map((d: any) => toPlain(d));

      if (!rows?.length) {
        return res.status(200).json({ ok: true, data: [] });
      }

      // 2) build stable price keys (do NOT use investmentId which may be undefined)
      const normalize = (s?: string) => {
        const up = (s || "").trim().toUpperCase();
        if (up === "APPL") return "AAPL";
        if (up === "TLSA") return "TSLA";
        if (up === "SNP500") return "SPX";
        const m = up.match(/^([A-Z0-9]+)\/USD$/);
        return m ? m[1] : up;
      };
      const basketKey = (b?: Array<{ symbol: string; weight: number }>) =>
        Array.isArray(b) ? JSON.stringify([...b].sort((a, z) => a.symbol.localeCompare(z.symbol))) : "[]";

      const priceKeyFor = (inv: any) =>
        inv.type === "smart-mix"
          ? `mix|${normalize(inv.asset)}|${basketKey(inv.basket)}`
          : `single|${normalize(inv.asset)}`;

      // 3) dedupe live-price calls by key
      const uniq: Record<string, any> = {};
      for (const inv of rows) {
        const key = priceKeyFor(inv);
        if (!uniq[key]) uniq[key] = inv;
      }

      const priceMap = new Map<string, number>();
      await Promise.all(
        Object.entries(uniq).map(async ([key, inv]) => {
          try {
            const px = await investmentService["getLivePrice"](
              inv.asset!, { type: inv.type as any, basket: inv.basket as any }
            );
            priceMap.set(key, Number(px) || 0);
          } catch {
            priceMap.set(key, 0);
          }
        })
      );

      // 4) per-row “easy mode” P&L (aligned with your portfolio-summary math)
      const augmented = rows.map((inv: any) => {
        const key = priceKeyFor(inv);
        const live = priceMap.get(key) ?? 0;

        const qty = Number(inv.amount || 0);            // buy rows: remaining qty (your sell flow subtracts)
        const exec = Number(inv.priceAtExecution || 0);
        const fees = Number(inv.feesUsd || 0);

        let remainingQty = 0;
        let currentValue = 0;
        let realized = 0;
        let unrealized = 0;

        if ((inv.side || "buy") === "buy") {
          remainingQty = qty;
          const basis = exec * qty + fees;
          currentValue = qty * live;
          unrealized = currentValue - basis;
        } else {
          const proceeds = Number(inv.usdAmount || exec * qty);
          const cost = exec * qty;
          realized = proceeds - fees - cost;
        }

        const total = realized + unrealized;
        const basisForPct =
          (inv.side || "buy") === "buy"
            ? exec * qty + fees
            : Number(inv.usdAmount || exec * qty);
        const pnlPct = basisForPct > 0 ? (total / basisForPct) * 100 : 0;

        return {
          ...inv, // already plain
          currentPrice: +Number(live).toFixed(8),
          remainingQty: +Number(remainingQty).toFixed(8),
          currentValueUsd: +Number(currentValue).toFixed(2),
          realizedPnlUsd: +Number(realized).toFixed(2),
          unrealizedPnlUsd: +Number(unrealized).toFixed(2),
          totalPnlUsd: +Number(total).toFixed(2),
          pnlPct: +Number(pnlPct).toFixed(2),
        };
      });

      return res.status(200).json({ ok: true, data: augmented });
    } catch (err: any) {
      console.error("getInvestmentsByEmail error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error fetching investments" });
    }
  }


  async getInvestmentById(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const result = await investmentService.getInvestmentById(id);
      if (!result) return res.status(404).json({ ok: false, error: "Not found" });
      return res.status(200).json({ ok: true, data: result });
    } catch (err: any) {
      console.error("getInvestmentById error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error fetching investment" });
    }
  }

  async updateInvestment(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const updates = req.body;
      const result = await investmentService.updateInvestment(id, updates);
      if (!result) return res.status(404).json({ ok: false, error: "Not found" });
      return res.status(200).json({ ok: true, data: result });
    } catch (err: any) {
      console.error("updateInvestment error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error updating investment" });
    }
  }

  async deleteInvestment(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const result = await investmentService.deleteInvestment(id);
      if (!result) return res.status(404).json({ ok: false, error: "Not found" });
      return res.status(200).json({ ok: true, data: { message: "Deleted successfully" } });
    } catch (err: any) {
      console.error("deleteInvestment error:", err?.message || err);
      return res.status(500).json({ ok: false, error: "Error deleting investment" });
    }
  }

  async getPortfolioSummary(req: Request, res: Response) {
    try {
      const email = String(req.params.email).toLowerCase();
      const cacheKey = `pf:sum:${email}`;
      const redis = await ensureRedisConnected();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({ ok: true, data: JSON.parse(cached), cached: true });
      }

      const investments = await investmentService.getInvestmentsByEmail(email);
      let totalInvested = 0, currentValue = 0;

      for (const inv of investments) {
        const qty = Number(inv.amount || 0);
        const paid = Number(inv.usdAmount || 0);
        totalInvested += paid;

        const live = await investmentService["getLivePrice"](
          inv.asset!, { type: inv.type as any, basket: inv.basket as any }
        );
        currentValue += qty * live;
      }

      const data = {
        totalInvested: +totalInvested.toFixed(2),
        currentValue: +currentValue.toFixed(2),
        gainLossPct: totalInvested > 0 ? +(((currentValue - totalInvested) / totalInvested) * 100).toFixed(2) : 0
      };

      await redis.setEx(cacheKey, SUMMARY_TTL_SEC, JSON.stringify(data));
      return res.status(200).json({ ok: true, data });
    } catch (e) {
      console.error("getPortfolioSummary error:", e);
      return res.status(500).json({ ok: false, error: "Error fetching portfolio summary" });
    }
  }

}
