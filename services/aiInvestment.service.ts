import { Investment } from "../data/aiInvestment";
import { adjustBalancesNoTxn, findWallet, getUserWalletDoc } from "../helpers/walletHelpers";
import InvestmentSchema, { InvestmentModel } from "../models/aiInvestment";

import { ServiceBase } from "./base";
import Binance from "node-binance-api";
import { OrderService } from "./order.service";
import { SendEmail } from "../platform/email.operations";
import { TransactionService } from "./transaction.service";
import { Order, OrderBreakdown, OrderStatus, OrderType, Rates } from "../data/order";
import { PaymentTypes } from "../data/common";
import { UserLite } from "../data/user";
import { v1 as uuidv1 } from "uuid";
import { UserService } from "./user.service";
const orderService: OrderService = new OrderService();
const uservice: UserService = new UserService();
const txservice: TransactionService = new TransactionService();
type SelectionType = "crypto" | "stock" | "smart-mix";
type MixLeg = { symbol: string; weight: number };


const binance = new Binance().options({
  APIKEY: process.env.BINANCE__KEY!,
  APISECRET: process.env.BINANCE_SECRET!,
  useServerTime: false,
});

export class InvestmentService extends ServiceBase<Investment, InvestmentModel> {
  constructor() {
    super(InvestmentSchema, "aiInvestments");
  }


  private normalize(sym: string) {
    const up = sym.trim().toUpperCase();
    if (up === "APPL") return "AAPL";
    if (up === "TLSA") return "TSLA";
    if (up === "SNP500") return "SPX";
    const m = up.match(/^([A-Z0-9]+)\/USD$/); // "ETH/USD" -> "ETH"
    return m ? m[1] : up;
  }

  /** Single symbol price via Binance USDT for crypto, StockService for equities */
  private async fetchSinglePrice(symRaw: string): Promise<number> {
    const sym = this.normalize(symRaw);
    // naive stock detection; if you have token meta, prefer that
    const stockTickers = new Set(["AAPL", "AMZN", "TSLA", "MSFT", "NVDA", "META", "GOOGL", "PEP", "SPX", "AVGO"]);
    const isStock = stockTickers.has(sym);

    if (isStock) {
      // If your StockService can’t do SPX, map to SPY here
      const ticker = sym === "SPX" ? "SPX" : sym;
      return await new (require("../services/stock.service").StockService)().fetchStockPrice(ticker);
    }

    // Crypto via Binance
    const querySymbol = `${sym}USDT`;
    const prices = await binance.prices(querySymbol);
    // BUGFIX: check the right key
    const px = prices[querySymbol];
    if (!px) throw new Error(`Price not available for ${querySymbol}`);
    return parseFloat(px);
  }

  /** Live price for single or smart-mix (weighted) */
  private async getLivePrice(
    asset: string,
    opts?: { type?: SelectionType; basket?: MixLeg[] }
  ): Promise<number> {
    if (opts?.type === "smart-mix" && Array.isArray(opts.basket) && opts.basket.length) {
      const total = opts.basket.reduce((s, l) => s + (l.weight || 0), 0) || 100;
      let sum = 0;
      for (const leg of opts.basket) {
        const p = await this.fetchSinglePrice(leg.symbol);
        sum += p * ((leg.weight || 0) / total);
      }
      return sum;
    }
    return await this.fetchSinglePrice(asset);
  }


  private async buildOrderFromInvestment(
    inv: Required<Pick<Investment, "email" | "asset" | "usdAmount">>,
    livePrice: number,
    qty: number,
    orderType: OrderType = OrderType.AIBuy
  ): Promise<Order> {
    const breakdown = {
      inCurrenyName: "USD",            // keep your existing field spelling
      inAmount: Number(inv.usdAmount),
      outCurrencyName: inv.asset,
      outAmount: Number(qty),
    } as OrderBreakdown;;

    const orderRate: Rates = {
      currency: inv.asset,
      rate: Number(livePrice),
    };

    // look up user by email (no req usage here)
    const email = String(inv.email).toLowerCase();
    const user = await uservice.findOneSelect(
      { email },
      { _id: 1, firstName: 1, lastName: 1, isVerified: 1, language: 1, verification: 1 }
    );

    const userLite = {
      userId: user?._id,              // may be undefined if not found (ok if optional)
      email,
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      isVerified: user.verification.activated,
      language: user?.language ?? "en",
    } as UserLite;


    const order = {
      orderId: Math.floor(10000000 + Math.random() * 90000000).toString(),
      status: OrderStatus.Quoted,
      orderType,                      // AIBuy by default; pass AISell when selling
      orderRate,
      receiverAccount: {} as any,
      paymentType: PaymentTypes.USD,
      breakdown,
      user: userLite,
      created: new Date(),
      exchangeFees: 0,
      isCaptainPerformingOrder: false,
      captainBeeEmail: "",
      blockchainName: "",             // fill if you need chain info for crypto assets
      notes: "",                      // include if your Order type defines it
    } as Order;

    return order;
  }


  async createInvestment(payload: Investment): Promise<Investment> {
    const livePrice = payload.simulatedPrice;
    if (!payload.email) throw new Error("email required");
    if (!payload.asset) throw new Error("asset required");
    if (!payload.usdAmount || payload.usdAmount <= 0) throw new Error("usdAmount must be > 0");
    if (livePrice <= 0) throw new Error("Live price unavailable");

    const qty = Number((payload.usdAmount / livePrice).toFixed(8));

    // move USD -> ASSET w/out sessions
    await adjustBalancesNoTxn(
      payload.email,
      { symbol: "USD", amount: payload.usdAmount },
      { symbol: payload.asset, amount: qty }
    );

    // optional sanity check
    const doc = await getUserWalletDoc(payload.email);
    if (!findWallet(doc, "USD") || !findWallet(doc, payload.asset)) {
      throw new Error("Wallet update failed");
    }

    const investment: Investment = {
      ...payload,
      amount: qty,
      priceAtExecution: livePrice,
      simulatedPrice: livePrice,
      status: "executed",
      createdAt: new Date(),
    };

    const order = await this.buildOrderFromInvestment(
      { email: payload.email, asset: payload.asset, usdAmount: payload.usdAmount },
      livePrice,
      qty
    );

    let createOrder = await orderService.create(order);

    //once create order get the order details and process the order
    let getOrderDetails = await orderService.findOne({ orderId: createOrder.orderId });
    if (!getOrderDetails) throw new Error("Order not found after creation");

    const process = await orderService.processOrder(getOrderDetails);
    const getNewDetails = await orderService.findOne({ orderId: createOrder.orderId });

    await new SendEmail().sendOrderCompleted(
      getNewDetails.user.email,
      "User",
      getNewDetails.breakdown.outAmount,
      getNewDetails.breakdown.outCurrencyName,
      getNewDetails.orderType,
      getNewDetails.orderRate.rate,
      getNewDetails.breakdown.inAmount,
      getNewDetails.notes,
      getNewDetails.orderId
    );

    await txservice.create({
      email: getNewDetails.user.email,
      orderId: getNewDetails.orderId,
      extRef: "",
      txId: "",
      from: "",
      to: getNewDetails.user.email,
      amount: getNewDetails.breakdown.outAmount,
      exchangeName: "CEX",
      info: "Buy Ai Investment by user",
      status: OrderStatus.Completed,
      currencyRef: getNewDetails.breakdown.outCurrencyName,
      walletType: "ASSET_WALLET",
      transactionType: "AI-BUY",
      txDate: new Date(),
      benificaryAddress: "",
      notes: "Ai Investment purchase",
    });


    return await this.create(investment);
  }

  async sellInvestment(opts: {
    investmentId: string;
    email: string;                // ownership check
    amount?: number;              // asset qty to sell (optional)
    percent?: number;             // 1..100 optional if amount not given
  }): Promise<Investment> {
    const inv = await this.findOne({ _id: opts.investmentId });
    if (!inv) throw new Error("Investment not found");
    if (inv.email.toLowerCase() !== opts.email.toLowerCase()) throw new Error("Forbidden");

    // Determine qty to sell
    const heldQty = Number(inv.amount || 0);
    if (heldQty <= 0) throw new Error("No position to sell");
    let sellQty = Number(opts.amount ?? 0);
    if (!sellQty && opts.percent) {
      sellQty = +(heldQty * Math.min(100, Math.max(1, opts.percent)) / 100).toFixed(8);
    }
    if (!sellQty || sellQty <= 0) throw new Error("amount or percent required");
    if (sellQty > heldQty) throw new Error("Insufficient position");

    // Price (single or smart-mix)
    const livePrice = await this.getLivePrice(inv.asset!, { type: inv.type as SelectionType, basket: inv.basket as MixLeg[] | undefined });
    if (!isFinite(livePrice) || livePrice <= 0) throw new Error("Live price unavailable");

    const usdProceeds = +(sellQty * livePrice).toFixed(2);

    // Wallet transfers: ASSET -> USD
    await adjustBalancesNoTxn(
      inv.email,
      { symbol: inv.asset!, amount: sellQty },
      { symbol: "USD", amount: usdProceeds }
    );

    const doc = await getUserWalletDoc(inv.email);
    if (!findWallet(doc, "USD") || !findWallet(doc, inv.asset!)) {
      throw new Error("Wallet update failed");
    }

    // Persist a new sell record (or you can append to history)
    const sellRecord: Investment = {
      ...inv,
      investmentId: uuidv1(),         // create a new record for the sell
      amount: sellQty,
      usdAmount: usdProceeds,
      priceAtExecution: livePrice,
      simulatedPrice: livePrice,
      status: "executed",
      createdAt: new Date(),
      side: "sell" as any,
    };

    // Build and process order
    const orderRate = { currency: inv.asset!, rate: livePrice };
    const breakdown = {
      inCurrenyName: inv.asset!,
      inAmount: sellQty,
      outCurrencyName: "USD",
      outAmount: usdProceeds,
    };
    const order = {
      orderId: Math.floor(10000000 + Math.random() * 90000000).toString(),
      status: OrderStatus.Quoted,
      orderType: OrderType.AISell,
      orderRate,
      receiverAccount: {} as any,
      paymentType: PaymentTypes.USD,
      breakdown,
      user: {
        userId: undefined as any,
        email: inv.email.toLowerCase(),
        firstName: "",
        lastName: "",
        isVerified: true,
        language: "en",
      } as UserLite,
      created: new Date(),
      exchangeFees: 0,
      isCaptainPerformingOrder: false,
      captainBeeEmail: "",
      blockchainName: "",
    } as Order;

    await orderService.processOrder(order);
    const od = await orderService.findOne({ orderId: order.orderId });

    await new SendEmail().sendOrderCompleted(
      od.user.email,
      "User",
      od.breakdown.outAmount,
      od.breakdown.outCurrencyName,
      od.orderType,
      od.orderRate.rate,
      od.breakdown.inAmount,
      od.notes,
      od.orderId
    );

    await txservice.create({
      email: od.user.email,
      orderId: od.orderId,
      extRef: "",
      txId: "",
      from: od.user.email,
      to: "",
      amount: od.breakdown.outAmount,
      exchangeName: "CEX",
      info: "Sell Ai Investment by user",
      status: OrderStatus.Completed,
      currencyRef: od.breakdown.outCurrencyName,
      walletType: "ASSET_WALLET",
      transactionType: "AI-SELL",
      txDate: new Date(),
      benificaryAddress: "",
      notes: "Ai Investment sale",
    });

    // OPTIONAL: reduce original position’s remaining amount
    await this.updatePart({ investmentId: inv.investmentId }, { amount: +(heldQty - sellQty).toFixed(8) });

    return await this.create(sellRecord);
  }

  async getInvestmentsByUser(userId: string): Promise<Investment[]> {
    return this.find({ userId });
  }

  async getInvestmentsByEmail(email: string): Promise<Investment[]> {
    return this.find({ email });
  }

  async getInvestmentById(id: string): Promise<Investment | null> {
    return this.findOne({ _id: id });
  }

  async updateInvestment(
    id: string,
    updates: Partial<Investment>
  ): Promise<Investment | null> {
    return this.updatePart({ _id: id }, updates);
  }

  async deleteInvestment(id: string): Promise<Investment | null> {
    return this.delete(id);
  }
}

export default new InvestmentService();
