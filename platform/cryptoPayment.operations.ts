import Web3 from "web3";
import { ethers } from "ethers";
import { keys } from "../config/keys";
import { OrderStatus, OrderTransaction, Order } from "../data/order";
import { Currency } from "../data/common";
import { OrderService } from "../services/order.service";
import { BTCYBuyHistoryService } from "../services/btcyBuyHistory.service";
import { PaymentTxLockService } from "../services/paymentTxLock.service";
import { TransactionService } from "../services/transaction.service";
import { UserService } from "../services/user.service";
import {
  Connection,
  clusterApiUrl,
  PublicKey,
  LogsCallback,
} from "@solana/web3.js";
import type { Commitment, AccountInfo, Context } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { waitReceiptAny } from "../helpers/waitReceipt";
import {
  applyQuantumBtcyBonusIfNeeded,
  appendQuantumBtcyBonusNote,
} from "../helpers/quantumBtcyBonus";
import { ChatSocketService } from "../services/chatWebsocket.service";
import { getConfiguredBtcyFeePercent } from "../helpers/btcyFees";

// registry of active monitors per order
type EthMonitor = {
  chain: "ETH";
  sub: any;
  ws: Web3["currentProvider"];
  timer: NodeJS.Timeout;
};
type SolMonitor = {
  chain: "SOL";
  sub: number;
  conn: Connection;
  timer: NodeJS.Timeout;
};
const activeMonitors = new Map<string, EthMonitor | SolMonitor>();

type CoinSymbol = "USDT" | "USDC";

type ManualQuantumPaymentCheckInput = {
  paymentType: CoinSymbol;
  amount: number;
  addressPaidTo: string;
  txHash?: string;
  retryMs?: number;
  retryIntervalMs?: number;
};

type DetectedCryptoPayment = {
  from: string;
  to: string;
  transferredAmount: number;
  confirmations: number | string;
  coin: CoinSymbol;
  txHash: string;
  blockchain: "Ethereum" | "Solana";
};

type ConfirmCryptoPaymentResult = {
  success: boolean;
  message: string;
  data?: any;
  duplicateTxHash?: boolean;
  existingOrderId?: string | null;
};

type EthPaymentConfirmed = {
  kind: "confirmed";
  from: string;
  to: string;
  transferredAmount: number;
  confirmations: number;
  coin: CoinSymbol;
  txHash: string;
  blockchain: "Ethereum";
};

type EthPaymentPending = {
  kind: "pending";
  confirmations: number;
  coin: CoinSymbol;
  txHash: string;
  blockchain: "Ethereum";
};

type EthPaymentResult = EthPaymentConfirmed | EthPaymentPending | null;

// --- ETH logs poller (shared) ---
const ETH_TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");

type PendingEthOrder = {
  orderId: string;
  coin: CoinSymbol; // 'USDT' | 'USDC'
  expectedAmount: number;
  to: string; // our Ethereum wallet (checksummed)
  createdAt: number; // ms
};

const pendingEthOrders = new Map<string, PendingEthOrder>();
const ethOrderTimers = new Map<string, NodeJS.Timeout>();

const ethLogsState: {
  started: boolean;
  lastSeen: number;
  interval: NodeJS.Timeout | null;
} = { started: false, lastSeen: 0, interval: null };

// Find the order's email once (avoid repeating lookups)
async function getOrderEmail(orderId: string): Promise<string | null> {
  try {
    const o = await orderService.findOne({ orderId });
    return o?.user?.email ? String(o.user.email).toLowerCase() : null;
  } catch {
    return null;
  }
}

// Safe emit wrapper
async function emitToOrderUser(orderId: string, event: string, payload: any) {
  try {
    const email = await getOrderEmail(orderId);
    if (!email) return;
    ChatSocketService.emitToUser(email, event, payload);
  } catch (e) {
    console.warn(`[socket] emit failed for ${orderId}/${event}:`, e);
  }
}

export function calculateFeeAmount(baseAmount: number) {
  const feePercent = getConfiguredBtcyFeePercent();

  const fee = (baseAmount * feePercent) / 100;
  const netAmount = Math.max(0, baseAmount - fee);
  const total = baseAmount;

  return {
    baseAmount,
    feePercent,
    fee,
    netAmount,
    total,
  };
}

function cleanupMonitor(orderId: string) {
  const m = activeMonitors.get(orderId);
  if (!m) return;

  // stop the expiry timer
  try {
    if (m.timer) clearTimeout(m.timer);
  } catch {}

  // ETH: unsubscribe + disconnect WS
  if ((m as EthMonitor).chain === "ETH") {
    const em = m as EthMonitor;
    try {
      if (em.sub && typeof em.sub.unsubscribe === "function") {
        const wsAny: any = em.ws as any;
        const isOpen =
          wsAny?.connection?.readyState === wsAny?.connection?.OPEN ||
          wsAny?.connected === true;

        if (isOpen) {
          em.sub.unsubscribe((err: any, ok: boolean) => {
            if (err) console.warn(`ETH unsubscribe error for ${orderId}:`, err);
          });
        }
      }
    } catch {}
    try {
      const wsAny: any = em.ws as any;
      if (wsAny?.disconnect) wsAny.disconnect(1000, "done");
      else if (wsAny?.connection?.close) wsAny.connection.close();
      else if (wsAny?.connection?.terminate) wsAny.connection.terminate();
    } catch {}
  }

  // SOL: remove logs listener
  if ((m as SolMonitor).chain === "SOL") {
    const sm = m as SolMonitor;
    try {
      sm.conn.removeAccountChangeListener(sm.sub).catch(() => {});
    } catch {}
  }

  activeMonitors.delete(orderId);
}

// Map token symbol → mint address from config (don’t hardcode)
function getSolanaMintFor0(coin: string): string {
  const c = (coin || "").toUpperCase().trim();
  const fromEnv =
    c === "USDC"
      ? keys.SOL_USDC_MINT?.key
      : c === "USDT"
      ? keys.SOL_USDT_MINT?.key
      : undefined;

  // mainnet native fallbacks (optional but handy)
  const fallback =
    c === "USDC"
      ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      : c === "USDT"
      ? "Es9vMFrzaCERz9r9bFz9b3sYwiJ4oy4aNime5qRhK7kX"
      : undefined;

  const mint = (fromEnv || fallback || "").trim();
  if (!mint) throw new Error(`No mint configured for ${c} on Solana`);
  // validate here too to fail early with a clear message
  new PublicKey(mint);
  return mint;
}

function getSolanaMintFor(coin: string): string {
  const c = (coin || "").toUpperCase().trim();
  const envMint =
    c === "USDC"
      ? keys.SOL_USDC_MINT?.key
      : c === "USDT"
      ? keys.SOL_USDT_MINT?.key
      : undefined;

  // Only keep a fallback you are 100% sure about:
  const defaults: Record<string, string | undefined> = {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: undefined, // force using env for USDT to avoid wrong hardcodes
  };

  const candidates = [envMint, defaults[c]].filter(Boolean) as string[];

  for (const cand of candidates) {
    const s = cand.trim();
    try {
      const pk = new PublicKey(s);
      return pk.toBase58(); // normalized & validated
    } catch {
      // try next candidate
    }
  }

  console.error(
    `Invalid or missing mint for ${c}. Env: ${JSON.stringify(
      envMint
    )} Default: ${JSON.stringify(defaults[c])}`
  );
  throw new Error(
    `No valid mint configured for ${c} on Solana. Set SOL_${c}_MINT to a valid base58 address.`
  );
}

function getSolanaRpcUrls() {
  const isDev = false;
  const WS = isDev ? keys.SOL_DEV_WS_URL?.key : keys.SOL_MAIN_WS_URL?.key;
  const RPC = isDev
    ? keys.SOLANA_DEV_RPC_URL?.key
    : keys.SOLANA_MAIN_RPC_URL?.key;

  if (!RPC)
    throw new Error(
      "Missing RPC URL for Solana (set SOLANA_DEV_RPC_URL / SOLANA_MAIN_RPC_URL)"
    );
  if (!WS)
    throw new Error(
      "Missing WS URL for Solana (set SOL_DEV_WS_URL / SOL_MAIN_WS_URL)"
    );

  return { WS, RPC };
}

const orderService: OrderService = new OrderService();
const btcyBuyHistoryService: BTCYBuyHistoryService =
  new BTCYBuyHistoryService();
const paymentTxLockService: PaymentTxLockService = new PaymentTxLockService();
const txService: TransactionService = new TransactionService();
const userService: UserService = new UserService();
// ERC-20 ABI for USDT/USDC token transfers
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
];

function assertPubkey(input: string, name: string): PublicKey {
  const s = String(input || "").trim();
  try {
    return new PublicKey(s);
  } catch {
    throw new Error(`${name} is not a valid Solana address: "${s}"`);
  }
}

const INFURA_KEY = keys.INFURA_KEY?.key;
const ALCHEMY_MAIN = keys.ALCHEMYKEY_MAIN?.key; // mainnet
const INFURA_KEYS = (keys.INFURA_KEYS?.key || keys.INFURA_KEY?.key || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function makeEthProvidersList(network: "mainnet" | "sepolia" = "mainnet") {
  const net =
    network === "mainnet"
      ? { name: "homestead", chainId: 1 }
      : { name: "sepolia", chainId: 11155111 };

  const urls: string[] = [];

  // multiple Infura keys
  for (const inf of INFURA_KEYS) {
    urls.push(`https://${network}.infura.io/v3/${inf}`);
  }

  // optional Alchemy (either full url or you’ve already fixed it)
  if (network === "mainnet" && ALCHEMY_MAIN) {
    urls.push(ALCHEMY_MAIN); // if you stored full URL
  }

  if (!urls.length) throw new Error("No Ethereum RPC configured");

  return urls.map(
    (url) =>
      new ethers.providers.StaticJsonRpcProvider({ url, timeout: 20_000 }, net)
  );
}

function makeEthProvider(network: "mainnet" | "sepolia" = "mainnet") {
  const urls: string[] = [];

  if (INFURA_KEY) urls.push(`https://${network}.infura.io/v3/${INFURA_KEY}`);

  if (network === "mainnet" && ALCHEMY_MAIN) {
    urls.push(`${ALCHEMY_MAIN}`);
  }

  if (urls.length === 0) {
    throw new Error(
      `No Ethereum RPC configured for ${network}. Set INFURA_KEY or the matching ALCHEMY key.`
    );
  }

  const net =
    network === "mainnet"
      ? { name: "homestead", chainId: 1 }
      : { name: "sepolia", chainId: 11155111 };

  const providers = urls.map((url) => ({
    provider: new ethers.providers.StaticJsonRpcProvider(
      { url, timeout: 10_000 },
      net
    ),
    priority: 1,
    weight: 1,
    stallTimeout: 2_000,
  }));

  return providers.length > 1
    ? new ethers.providers.FallbackProvider(providers as any, 1)
    : providers[0].provider;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 5,
  baseMs = 500
): Promise<T> {
  let n = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      n++;
      if (n >= tries) throw e;
      const backoff = baseMs * 2 ** (n - 1) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

// Known mainnet ERC20 addresses (adjust if you support testnets)
const ETH_TOKENS = {
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

// Minimal ABI for logs/decimals
const ERC20_LOG_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)",
];

/**
 * Get our wallet address for receiving payments
 * We have only 2 wallets total:
 * - One Ethereum wallet for both USDT and USDC
 * - One Solana wallet for both USDT and USDC
 * @param blockchain - 'Ethereum' or 'Solana'
 * @returns our wallet address from environment variables
 */
export function getOurWalletAddress(blockchain: string): string {
  if (blockchain === "Ethereum") {
    return keys.OUR_ETHEREUM_WALLET.key;
  }
  if (blockchain === "Solana") {
    return keys.OUR_SOLANA_WALLET.key;
  }
  throw new Error(`No wallet address configured for blockchain: ${blockchain}`);
}

/**
 * Create order with pending status
 * Works for both PayPal and crypto payments
 */
export async function createPaymentOrder(
  email: string,
  paymentMethod: string, // 'paypal', 'usdt', 'usdc'
  amount: number,
  blockchain?: string, // Required for crypto payments
  orderType: string = "Payment"
) {
  try {
    // Generate unique order ID
    const orderId = `PAY_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Basic order data following the Order model structure
    let orderData: any = {
      orderId: orderId,
      user: { email: email },
      status: OrderStatus.Pending,
      orderType: orderType as any,
      currency:
        paymentMethod === "paypal"
          ? ("USD" as any)
          : (paymentMethod.toUpperCase() as any),
      amount: amount,
      breakdown: {
        inCurrenyName:
          paymentMethod === "paypal" ? "USD" : paymentMethod.toUpperCase(),
        inAmount: amount,
        outCurrencyName:
          paymentMethod === "paypal" ? "USD" : paymentMethod.toUpperCase(),
        outAmount: amount,
        finalAmountAfterDiscount: amount,
      },
      exchangeName: "PaymentProcessor",
      created: new Date(),
      orderCompletedOn: null,
      transactions: [],
      receiverAccount: {
        userReceiveAddress: "",
        userReceiveName: "",
        userId: "",
        userReceivePhone: "",
      },
      paymentType: "Crypto" as any,
      orderRate: { buyPrice: 1, sellPrice: 1, marketPrice: 1 },
      comments: `Payment method: ${paymentMethod}`,
      notes: "",
    };

    let receiverAddress = "";

    // Handle different payment methods
    if (paymentMethod === "paypal") {
      // PayPal payment - no additional setup needed
      orderData.comments += " | PayPal Payment";
    } else if (
      (paymentMethod === "usdt" || paymentMethod === "usdc") &&
      blockchain
    ) {
      // Crypto payment - get our wallet address (same wallet for both USDT and USDC)
      const currency = paymentMethod.toUpperCase();
      receiverAddress = getOurWalletAddress(blockchain);

      orderData.comments += ` | Blockchain: ${blockchain} | Token: ${currency} | Receiver: ${receiverAddress}`;
      orderData.receiverAccount.userReceiveAddress = receiverAddress;

      // Set 10-minute expiry
      orderData.expirationDate = new Date(Date.now() + 10 * 60 * 1000);
    }

    // Create order in database
    const createdOrder = await orderService.create(orderData as Order);

    await emitToOrderUser(orderId, "order:created", {
      orderId,
      status: "Pending",
      blockchain,
      coin: paymentMethod.toUpperCase(),
      amount,
      receiverAddress,
      expiresAt: orderData.expirationDate,
    });

    // Start monitoring for crypto payments
    if (paymentMethod === "usdt" || paymentMethod === "usdc") {
      console.log(`Starting payment monitoring for order ${orderId}`);
      startPaymentMonitoring(
        paymentMethod.toUpperCase(),
        blockchain!,
        orderId,
        amount
      );
    }

    return {
      success: true,
      orderId: orderId,
      paymentMethod: paymentMethod,
      amount: amount,
      receiverAddress: receiverAddress,
      expiresAt: orderData.expirationDate,
      message:
        paymentMethod === "paypal"
          ? "Order created. Proceed with PayPal payment."
          : `Order created. Transfer ${amount} ${paymentMethod.toUpperCase()} to ${receiverAddress} within 10 minutes.`,
    };
  } catch (err) {
    console.error("Error creating payment order:", err);
    return { success: false, error: err };
  }
}

/**
 * Start monitoring blockchain for payments to our wallet
 * Only monitors transactions TO OUR WALLET ADDRESS
 */
export function startPaymentMonitoring(
  coin: string, // 'USDT' or 'USDC'
  blockchain: string, // 'Ethereum' or 'Solana'
  orderId: string,
  expectedAmount: number
) {
  try {
    // Get our wallet address (same wallet for both USDT and USDC on each blockchain)
    const ourWalletAddress = getOurWalletAddress(blockchain);
    console.log(
      `Monitoring ${coin} payments to OUR WALLET: ${ourWalletAddress} on ${blockchain}`
    );

    // tell client we’re watching
    emitToOrderUser(orderId, "payment:watching", {
      orderId,
      blockchain,
      coin,
      to: ourWalletAddress,
      expectedAmount,
      ttlMs: 10 * 60 * 1000,
    });

    if (blockchain === "Ethereum") {
      startEthereumMonitoring(ourWalletAddress, coin, orderId, expectedAmount);
    } else if (blockchain === "Solana") {
      startSolanaMonitoring(ourWalletAddress, coin, orderId, expectedAmount);
    }
  } catch (err) {
    console.error("Error starting payment monitoring:", err);
  }
}

// Reuse your helpers/constants:
const ETH_POLL_INTERVAL_MS = 60_000; // 1 minute
const CONFIRMATIONS_REQUIRED = 3;
const AMOUNT_TOLERANCE = 0.01; // 1%
const MANUAL_CHECK_RETRY_MS = 120_000;
const MANUAL_CHECK_INTERVAL_MS = 15_000;
const ETH_MANUAL_LOOKBACK_BLOCKS = 2_000;
const SOLANA_SIGNATURE_LOOKBACK_LIMIT = 25;

// Active ETH orders registry (for the poller)
type EthOrderWatch = {
  orderId: string;
  coin: "USDT" | "USDC";
  to: string; // your receiving wallet (same for both tokens)
  expectedAmount: number; // user should send
  expiresAt: number; // Date.now() + 10min
};
const activeEthOrders = new Map<string, EthOrderWatch>();

// Per-order expiry timers (to reuse your existing expiry path)
const ethOrderExpiryTimers = new Map<string, NodeJS.Timeout>();

// One provider for all ETH polling
let ethProvider:
  | ethers.providers.FallbackProvider
  | ethers.providers.StaticJsonRpcProvider
  | null = null;

// Safe init
function ensureEthProvider() {
  if (!ethProvider) {
    ethProvider = makeEthProvider("mainnet"); // you already have this helper
  }
  return ethProvider!;
}

// Precompute the Transfer topic once
const iface = new ethers.utils.Interface(ERC20_LOG_ABI);
const TRANSFER_TOPIC = iface.getEventTopic("Transfer");

// Pad/encode a checksummed address into a topic
function topicAddress(addr: string): string {
  return ethers.utils.hexZeroPad(ethers.utils.getAddress(addr), 32);
}

// Global scanning cursor
let lastScannedBlock: number | null = null;
let pollerStarted = false;

async function ethPollerTick() {
  const provider = ensureEthProvider();

  // Nothing to do?
  if (activeEthOrders.size === 0) return;

  // get latest block
  const head = await provider.getBlockNumber();

  // choose a sane fromBlock (buffer 5 blocks to avoid missing reorgs)
  const fromBlock = Math.max(lastScannedBlock ?? head - 5, head - 5);
  const toBlock = head;

  if (toBlock < fromBlock) {
    lastScannedBlock = head;
    return;
  }

  // Gather open orders by coin and by "to" (your wallet)
  const ordersByCoin: Record<"USDT" | "USDC", EthOrderWatch[]> = {
    USDT: [],
    USDC: [],
  };
  for (const o of activeEthOrders.values()) ordersByCoin[o.coin].push(o);

  // For each coin, fetch Transfer logs to your wallet ONCE, then match to orders by amount
  for (const coin of ["USDT", "USDC"] as const) {
    const token = ETH_TOKENS[coin];
    if (!token) continue;

    // all our distinct "to" addresses from current open orders (usually just one)
    const toSet = new Set(ordersByCoin[coin].map((o) => o.to.toLowerCase()));
    if (toSet.size === 0) continue;

    // Batch per “to” address so we keep filters narrow (and results small)
    for (const toAddrLower of toSet) {
      const toTopic = topicAddress(toAddrLower);

      // Single getLogs for this token+to across the block span
      const logs = await provider.getLogs({
        address: token,
        fromBlock,
        toBlock,
        topics: [TRANSFER_TOPIC, null, toTopic],
      });

      if (!logs.length) continue;

      // Fetch decimals once per token
      let decimals = 6;
      try {
        const erc20 = new ethers.Contract(token, ERC20_LOG_ABI, provider);
        decimals = await erc20.decimals();
      } catch {
        /* default 6 */
      }

      // Convert logs → enriched entries
      type Hit = {
        txHash: string;
        blockNumber: number;
        from: string;
        to: string;
        amount: number;
      };
      const hits: Hit[] = [];
      for (const l of logs) {
        try {
          const p = iface.parseLog(l);
          const to = p.args.to as string;
          const from = p.args.from as string;
          const amount = Number(
            ethers.utils.formatUnits(p.args.value, decimals)
          );
          hits.push({
            txHash: l.transactionHash,
            blockNumber: l.blockNumber,
            from,
            to,
            amount,
          });
        } catch {}
      }
      if (!hits.length) continue;

      // Match hits to open orders for this coin+to
      const candidateOrders = ordersByCoin[coin].filter(
        (o) => o.to.toLowerCase() === toAddrLower
      );
      if (!candidateOrders.length) continue;

      for (const hit of hits) {
        // Compute confirmations now
        const conf = Math.max(0, head - hit.blockNumber + 1);

        // Try to match this hit to any _one_ order by amount (±1%)
        // (If two orders share the same expected amount & window, first match wins)
        const matched = candidateOrders.find((o) => {
          const diff = Math.abs(hit.amount - o.expectedAmount);
          return diff <= o.expectedAmount * AMOUNT_TOLERANCE;
        });

        if (!matched) continue;

        // Emit PENDING if < 3 conf
        if (conf < CONFIRMATIONS_REQUIRED) {
          await emitToOrderUser(matched.orderId, "payment:pending", {
            orderId: matched.orderId,
            coin,
            blockchain: "Ethereum",
            txHash: hit.txHash,
            confirmations: conf,
            requiredConfirmations: CONFIRMATIONS_REQUIRED,
          });
          // do not remove yet; we’ll confirm later when conf >= 3
          continue;
        }

        // CONFIRMED: stop timers, unregister, confirm
        clearEthExpiry(matched.orderId);
        unregisterEthOrder(matched.orderId);

        await confirmCryptoPayment(
          {
            from: hit.from,
            to: hit.to,
            transferredAmount: hit.amount,
            confirmations: conf,
            coin,
            txHash: hit.txHash,
            blockchain: "Ethereum",
          },
          matched.orderId
        );
      }
    }
  }

  lastScannedBlock = toBlock;
}

function startEthPollerIfNeeded() {
  if (pollerStarted) return;
  pollerStarted = true;
  // kick a fast first tick, then steady every minute
  ethPollerTick().catch(() => {
    /* swallow */
  });
  setInterval(
    () =>
      ethPollerTick().catch(() => {
        /* swallow */
      }),
    ETH_POLL_INTERVAL_MS
  );
}

function registerEthOrder(o: EthOrderWatch) {
  activeEthOrders.set(o.orderId, o);
  startEthPollerIfNeeded();
}

function unregisterEthOrder(orderId: string) {
  activeEthOrders.delete(orderId);
}

function clearEthExpiry(orderId: string) {
  const t = ethOrderExpiryTimers.get(orderId);
  if (t) {
    clearTimeout(t);
    ethOrderExpiryTimers.delete(orderId);
  }
}

function stopMonitoringForOrder(orderId: string) {
  try {
    cleanupMonitor(orderId);
  } catch {}
  try {
    unregisterEthOrder(orderId);
  } catch {}
  try {
    clearEthExpiry(orderId);
  } catch {}
}

function amountsMatch(
  actual: number,
  expected: number,
  tolerance = AMOUNT_TOLERANCE
) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) {
    return false;
  }

  return actual >= expected * (1 - tolerance);
}

function normalizeCoin(value: string): CoinSymbol | null {
  const upper = String(value || "")
    .trim()
    .toUpperCase();
  if (upper === "USDT" || upper === "USDC") {
    return upper as CoinSymbol;
  }
  return null;
}

async function findExistingTxByHash(txHash: string) {
  return txService.findOne({ txId: txHash });
}

async function findDuplicateTxHash(txHash: string, orderId: string) {
  const lock = await paymentTxLockService.findOne({ txHash });
  if (lock?.orderId && String(lock.orderId) !== String(orderId)) {
    return lock;
  }
  const existing = await findExistingTxByHash(txHash);
  if (existing?.orderId && String(existing.orderId) !== String(orderId)) {
    return existing;
  }
  return null;
}

async function reserveTxHashForOrder(input: {
  txHash: string;
  orderId: string;
  email?: string;
  blockchain?: string;
  paymentType?: string;
  amount?: number;
  receiverAddress?: string;
}) {
  return paymentTxLockService.claimTxHash({
    txHash: input.txHash,
    orderId: input.orderId,
    email: input.email,
    status: "reserved",
    blockchain: input.blockchain,
    paymentType: input.paymentType,
    amount: input.amount,
    receiverAddress: input.receiverAddress,
  });
}

async function startEthereumMonitoring(
  ourWalletAddress: string,
  coin: string, // 'USDT' | 'USDC'
  orderId: string,
  expectedAmount: number
) {
  // Validate coin
  const upper = String(coin || "").toUpperCase();
  if (upper !== "USDT" && upper !== "USDC") {
    console.warn(`Unsupported ETH token: ${coin}`);
    return;
  }

  // Register order
  registerEthOrder({
    orderId,
    coin: upper as "USDT" | "USDC",
    to: ourWalletAddress,
    expectedAmount,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // One per-order 10-min expiry (keep your existing expireOrder)
  const timer = setTimeout(async () => {
    try {
      await expireOrder(orderId);
    } finally {
      unregisterEthOrder(orderId);
      clearEthExpiry(orderId);
    }
  }, 10 * 60 * 1000);

  ethOrderExpiryTimers.set(orderId, timer);

  // Tell the UI we’re watching (unchanged)
  await emitToOrderUser(orderId, "payment:watching", {
    orderId,
    blockchain: "Ethereum",
    coin: upper,
    to: ourWalletAddress,
    expectedAmount,
    ttlMs: 10 * 60 * 1000,
  });
}

/**
 * Confirm crypto payment and update order to completed
 */
async function confirmCryptoPayment(
  paymentData: DetectedCryptoPayment,
  orderId: string
): Promise<ConfirmCryptoPaymentResult> {
  try {
    console.log(`Confirming payment for order ${orderId}`);
    stopMonitoringForOrder(orderId);

    const orderDetails = await orderService.findOne({ orderId: orderId });

    if (!orderDetails) {
      console.error(`Order ${orderId} not found`);
      return { success: false, message: "Order not found" };
    }

    if (String(orderDetails.status) === String(OrderStatus.Completed)) {
      return {
        success: true,
        message: "Order already completed",
        data: {
          orderId,
          txHash: paymentData.txHash,
          alreadyCompleted: true,
        },
      };
    }

    if (paymentData.txHash) {
      const duplicateTx = await findDuplicateTxHash(
        paymentData.txHash,
        orderId
      );
      if (duplicateTx) {
        return {
          success: false,
          message: "Transaction hash already used for another order",
          duplicateTxHash: true,
          existingOrderId: duplicateTx.orderId || null,
        };
      }
    }

    const now = new Date();
    if (paymentData.txHash) {
      const lockClaim = await reserveTxHashForOrder({
        txHash: paymentData.txHash,
        orderId,
        email: orderDetails.user.email,
        blockchain: paymentData.blockchain,
        paymentType: paymentData.coin,
        amount: paymentData.transferredAmount,
        receiverAddress: paymentData.to,
      });

      if (!lockClaim.ok) {
        return {
          success: false,
          message: "Transaction hash already used for another order",
          duplicateTxHash: true,
          existingOrderId: lockClaim.existingOrderId || null,
        };
      }
    }

    const txPayload = {
      email: orderDetails.user.email,
      userWalletAddress: paymentData.from,
      orderId: orderId,
      extRef: "",
      txId: paymentData.txHash,
      from: paymentData.from,
      to: paymentData.to,
      amount: paymentData.transferredAmount,
      info: `${paymentData.coin} Payment Received`,
      status: OrderStatus.Completed,
      currencyRef: paymentData.coin,
      exchangeName: "PaymentProcessor",
      walletType: "CORE WALLET",
      transactionType: "CRYPTO_PAYMENT",
      txDate: now,
      benificaryAddress: paymentData.to,
    };

    const existingTx = paymentData.txHash
      ? await findExistingTxByHash(paymentData.txHash)
      : null;

    if (existingTx?.orderId && String(existingTx.orderId) === String(orderId)) {
      await txService.updatePart(
        { txId: paymentData.txHash },
        { $set: txPayload }
      );
    } else {
      await txService.create(txPayload as any);
    }

    // Create order transaction
    const orderTransaction: OrderTransaction = {
      currency: paymentData.coin as Currency,
      amount: paymentData.transferredAmount,
      trnReference: "",
      trnHash: paymentData.txHash,
      walletAddress: paymentData.to,
      created: now,
      status: "Completed",
    };

    const currentOutAmount = Number(orderDetails?.breakdown?.outAmount ?? 0);
    const bonusEval = applyQuantumBtcyBonusIfNeeded(orderDetails, currentOutAmount);
    const adjustedOutAmount = bonusEval.applied
      ? bonusEval.finalOutAmount
      : currentOutAmount;
    const updatedNotes = bonusEval.applied
      ? appendQuantumBtcyBonusNote(
          orderDetails?.notes || "",
          bonusEval.bonusAmount,
          adjustedOutAmount,
          now
        )
      : String(orderDetails?.notes || "");
    const existingOrderTransactions = Array.isArray(orderDetails.transactions)
      ? orderDetails.transactions
      : [];
    const orderTransactionIndex = existingOrderTransactions.findIndex(
      (tx) =>
        String(tx?.trnHash || "").toLowerCase() ===
        String(paymentData.txHash || "").toLowerCase()
    );
    const nextOrderTransactions =
      orderTransactionIndex >= 0
        ? existingOrderTransactions.map((tx, index) =>
            index === orderTransactionIndex
              ? {
                  ...tx,
                  ...orderTransaction,
                }
              : tx
          )
        : existingOrderTransactions.concat(orderTransaction);

    // Update order to completed
    const orderUpdateResult: any = await orderService.updatePart(
      { orderId: orderId, status: { $ne: OrderStatus.Completed } },
      {
        $set: {
          status: OrderStatus.Completed,
          orderCompletedOn: now,
          "breakdown.outAmount": adjustedOutAmount,
          transactions: nextOrderTransactions,
          notes: updatedNotes,
        },
      }
    );

    if (!orderUpdateResult || orderUpdateResult.modifiedCount === 0) {
      return {
        success: true,
        message: "Order already completed",
        data: {
          orderId,
          txHash: paymentData.txHash,
          alreadyCompleted: true,
        },
      };
    }

    const outCurrency = String(
      orderDetails?.breakdown?.outCurrencyName || ""
    ).toUpperCase();
    if (outCurrency === "BTCY") {
      try {
        const outAmount = adjustedOutAmount;
        const inAmount = Number(orderDetails?.breakdown?.inAmount ?? 0);
        const priceAtBuy =
          Number(orderDetails?.orderRate?.rate ?? 0) ||
          (outAmount > 0 ? inAmount / outAmount : 0);

        if (outAmount > 0 && priceAtBuy > 0) {
          await btcyBuyHistoryService.recordBuy({
            email: orderDetails.user.email,
            orderId: orderDetails.orderId,
            orderMongoId: String(orderDetails._id || ""),
            amount: outAmount,
            priceAtBuy,
            boughtAt: new Date(),
          });
        }
      } catch (err) {
        console.warn("Failed to record BTCY buy history", err);
      }
    }

    console.log(`✅ Payment confirmed for order ${orderId}`);

    // >>> notify the client <<<
    await emitToOrderUser(orderId, "order:confirmed", {
      orderId,
      status: "Completed",
      coin: paymentData.coin,
      blockchain: paymentData.blockchain,
      amount: paymentData.transferredAmount,
      from: paymentData.from,
      to: paymentData.to,
      txHash: paymentData.txHash,
    });

    // (optional) also send a generic “orders:update” event if your UI wants a single channel
    await emitToOrderUser(orderId, "orders:update", {
      orderId,
      status: "Completed",
    });

    // update the userWallet after order is completed
    const coin = String(
      orderDetails?.breakdown?.outCurrencyName || ""
    ).toUpperCase();
    const isBTCY = coin === "BTCY";
    const network = isBTCY ? "Ying Yang Chain" : undefined;

    const result = await orderService.checkAndCreateUserWallet(
      orderDetails.user.email,
      coin,
      false,
      network
    );
    console.log("result of checkAndCreateUserWallet", result);

    if (result) {
      const WALLET_ARRAY = "userWallets";
      const getOrderDetail = await orderService.findOne({ orderId: orderId });
      const incAmount = Number(getOrderDetail?.breakdown?.outAmount ?? 0);
      const arrayFilters = isBTCY
        ? [{ "w.coinSymbol": coin, "w.coinNetwork": network }]
        : [{ "w.coinSymbol": coin }];

      // try to update an existing wallet row
      const res: any = await userService.updatePartWithOptions(
        { email: orderDetails.user.email },
        {
          $inc: { [`${WALLET_ARRAY}.$[w].coinBalance`]: incAmount },
          $set: { [`${WALLET_ARRAY}.$[w].coinLastUsedOn`]: new Date() },
        },
        { arrayFilters }
      );
      console.log("User wallet updated:", res);

      // if no element matched, create one
      if (!res || res.modifiedCount === 0) {
        const pushRes = await userService.updatePart(
          { email: orderDetails.user.email },
          {
            $push: {
              [WALLET_ARRAY]: {
                coinSymbol: coin,
                coinNetwork: isBTCY ? network : null,
                coinBalance: incAmount,
                coinLastUsedOn: new Date(),
              },
            },
          }
        );
        console.log("Wallet entry created:", pushRes);
      }
    }

    if (paymentData.txHash) {
      await paymentTxLockService.markStatus(
        paymentData.txHash,
        orderId,
        "verified",
        {
          verifiedAt: new Date(),
          blockchain: paymentData.blockchain,
          paymentType: paymentData.coin,
          amount: paymentData.transferredAmount,
          receiverAddress: paymentData.to,
        }
      );
    }

    return {
      success: true,
      message: "Payment confirmed",
      data: {
        orderId,
        txHash: paymentData.txHash,
        amount: paymentData.transferredAmount,
        coin: paymentData.coin,
        blockchain: paymentData.blockchain,
        status: OrderStatus.Completed,
      },
    };
  } catch (err) {
    console.error("Error confirming payment:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Error confirming payment",
    };
  }
}

/**
 * Expire order if no payment received within 10 minutes
 */
async function expireOrder(orderId: string) {
  try {
    const order = await orderService.findOne({ orderId: orderId });

    if (order && order.status === OrderStatus.Pending) {
      await orderService.updatePart(
        { orderId: orderId },
        {
          $set: {
            status: "Expired",
            orderCompletedOn: new Date(),
          },
        }
      );

      console.log(`❌ Order ${orderId} expired - no payment received`);

      // tell the client
      await emitToOrderUser(orderId, "order:expired", {
        orderId,
        status: "Expired",
      });

      // optional generic update
      await emitToOrderUser(orderId, "orders:update", {
        orderId,
        status: "Expired",
      });
    }
  } catch (err) {
    console.error("Error expiring order:", err);
  }
}

async function parseErc20ReceiptAmountAndFrom(
  rcpt: ethers.providers.TransactionReceipt,
  tokenAddress: string,
  ourWalletAddress: string
): Promise<{ from: string; to: string; amount: number } | null> {
  const iface = new ethers.utils.Interface(ERC20_LOG_ABI);
  const transferTopic = iface.getEventTopic("Transfer");
  const our = ourWalletAddress.toLowerCase();

  const provider = makeEthProvider("mainnet");
  let decimals = 6;
  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_LOG_ABI, provider);
    decimals = await erc20.decimals();
  } catch {}

  for (const l of rcpt.logs) {
    if (l.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    if (l.topics[0] !== transferTopic) continue;
    const p = iface.parseLog(l);
    const to = (p.args.to as string).toLowerCase();
    if (to !== our) continue;
    const from = p.args.from as string;
    const amount = Number(
      ethers.utils.formatUnits(p.args.value as ethers.BigNumber, decimals)
    );
    return { from, to: p.args.to as string, amount };
  }
  return null;
}

async function inspectEthereumTxHash(
  txHash: string,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string
): Promise<DetectedCryptoPayment | null> {
  const provider = ensureEthProvider();
  const tokenAddress = ETH_TOKENS[coin];
  if (!tokenAddress) return null;

  const receipt = await provider
    .getTransactionReceipt(txHash)
    .catch(() => null);
  if (!receipt) return null;

  const parsed = await parseErc20ReceiptAmountAndFrom(
    receipt,
    tokenAddress,
    ourWalletAddress
  );

  if (!parsed) return null;

  const amount = parsed.amount;

  // 🔥 FIXED LOGIC
  if (amount <= 0 || !amountsMatch(amount, expectedAmount)) {
    return null;
  }

  const head = await provider.getBlockNumber();

  return {
    from: parsed.from,
    to: parsed.to,
    transferredAmount: amount,
    confirmations: Math.max(0, head - receipt.blockNumber + 1),
    coin,
    txHash,
    blockchain: "Ethereum",
  };
}

async function findEthereumRecentPayment(
  order: any,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string
): Promise<DetectedCryptoPayment | null> {
  const provider = ensureEthProvider();
  const tokenAddress = ETH_TOKENS[coin];
  if (!tokenAddress) return null;

  const head = await provider.getBlockNumber();
  const fromBlock = Math.max(0, head - ETH_MANUAL_LOOKBACK_BLOCKS);
  const logs = await provider.getLogs({
    address: tokenAddress,
    fromBlock,
    toBlock: head,
    topics: [TRANSFER_TOPIC, null, topicAddress(ourWalletAddress)],
  });

  if (!logs.length) return null;

  let decimals = 6;
  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_LOG_ABI, provider);
    decimals = await erc20.decimals();
  } catch {}

  const createdAtMs =
    new Date(order?.created || Date.now()).getTime() - 120_000;
  const hits: Array<{
    txHash: string;
    blockNumber: number;
    from: string;
    to: string;
    amount: number;
  }> = [];
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log);
      const amount = Number(
        ethers.utils.formatUnits(parsed.args.value, decimals)
      );
      if (!amountsMatch(amount, expectedAmount)) continue;
      hits.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        from: parsed.args.from as string,
        to: parsed.args.to as string,
        amount,
      });
    } catch {}
  }

  hits.sort((a, b) => b.blockNumber - a.blockNumber);

  for (const hit of hits) {
    const duplicate = await findDuplicateTxHash(hit.txHash, order.orderId);
    if (duplicate) continue;

    const block = await provider.getBlock(hit.blockNumber).catch(() => null);
    if (block && block.timestamp * 1000 < createdAtMs) {
      continue;
    }

    return {
      from: hit.from,
      to: hit.to,
      transferredAmount: hit.amount,
      confirmations: Math.max(0, head - hit.blockNumber + 1),
      coin,
      txHash: hit.txHash,
      blockchain: "Ethereum",
    };
  }

  return null;
}

async function extractSolanaPaymentFromParsedTx(
  tx: any,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string
): Promise<DetectedCryptoPayment | null> {
  if (!tx?.meta) return null;

  const owner = assertPubkey(ourWalletAddress, "OUR_SOLANA_WALLET");
  const mintAddr = assertPubkey(getSolanaMintFor(coin), `SOL_${coin}_MINT`);
  const ata = await getAssociatedTokenAddress(mintAddr, owner);

  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];

  const preMap = new Map<
    string,
    { mint: string; owner?: string; uiAmount?: number }
  >();

  pre.forEach((balance: any) => {
    preMap.set(String(balance.accountIndex), {
      mint: balance.mint,
      owner: balance.owner,
      uiAmount: balance.uiTokenAmount?.uiAmount ?? 0,
    });
  });

  for (const postBalance of post) {
    const accountIndex = String(postBalance.accountIndex);
    const prev = preMap.get(accountIndex);

    const ownerMatches =
      postBalance.owner?.toLowerCase?.() === ourWalletAddress.toLowerCase() ||
      prev?.owner?.toLowerCase?.() === ourWalletAddress.toLowerCase();

    if (!ownerMatches) continue;
    if (postBalance.mint !== mintAddr.toBase58()) continue;

    const before = prev?.uiAmount ?? 0;
    const after = postBalance.uiTokenAmount?.uiAmount ?? 0;

    const delta = after - before;

    if (delta <= 0) continue;

    // 🔥 FIXED LOGIC
    if (!amountsMatch(delta, expectedAmount)) continue;

    return {
      from: "unknown",
      to: ata.toBase58(),
      transferredAmount: delta,
      confirmations: tx.meta.err ? "failed" : "confirmed",
      coin,
      txHash: tx.transaction?.signatures?.[0] || "",
      blockchain: "Solana",
    };
  }

  return null;
}

async function inspectSolanaTxHash(
  txHash: string,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string
): Promise<DetectedCryptoPayment | null> {
  const { RPC, WS } = getSolanaRpcUrls();
  const connection = new Connection(RPC, {
    wsEndpoint: WS,
    commitment: "confirmed",
  });
  const tx = await connection.getParsedTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return null;
  return extractSolanaPaymentFromParsedTx(
    tx,
    coin,
    expectedAmount,
    ourWalletAddress
  );
}

async function findSolanaRecentPayment(
  order: any,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string
): Promise<DetectedCryptoPayment | null> {
  const { RPC, WS } = getSolanaRpcUrls();
  const connection = new Connection(RPC, {
    wsEndpoint: WS,
    commitment: "confirmed",
  });
  const owner = assertPubkey(ourWalletAddress, "OUR_SOLANA_WALLET");
  const mintAddr = assertPubkey(getSolanaMintFor(coin), `SOL_${coin}_MINT`);
  const ata = await getAssociatedTokenAddress(mintAddr, owner);
  const createdAtSec =
    Math.floor(new Date(order?.created || Date.now()).getTime() / 1000) - 120;
  const signatures = await withRetry(
    () =>
      connection.getSignaturesForAddress(
        ata,
        { limit: SOLANA_SIGNATURE_LOOKBACK_LIMIT },
        "confirmed"
      ),
    3,
    500
  );

  for (const sigInfo of signatures) {
    if (!sigInfo.signature) continue;
    if (sigInfo.blockTime && sigInfo.blockTime < createdAtSec) continue;

    const duplicate = await findDuplicateTxHash(
      sigInfo.signature,
      order.orderId
    );
    if (duplicate) continue;

    const tx = await connection.getParsedTransaction(sigInfo.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    const detected = await extractSolanaPaymentFromParsedTx(
      tx,
      coin,
      expectedAmount,
      ourWalletAddress
    );
    if (detected) {
      return detected;
    }
  }

  return null;
}

async function detectQuantumPayment(
  order: any,
  coin: CoinSymbol,
  expectedAmount: number,
  ourWalletAddress: string,
  txHash?: string
): Promise<DetectedCryptoPayment | null> {
  const blockchain = String(order?.blockchainName || "");
  if (blockchain === "Ethereum") {
    return txHash
      ? inspectEthereumTxHash(txHash, coin, expectedAmount, ourWalletAddress)
      : findEthereumRecentPayment(
          order,
          coin,
          expectedAmount,
          ourWalletAddress
        );
  }
  if (blockchain === "Solana") {
    return txHash
      ? inspectSolanaTxHash(txHash, coin, expectedAmount, ourWalletAddress)
      : findSolanaRecentPayment(order, coin, expectedAmount, ourWalletAddress);
  }
  return null;
}

/**
 * Placeholder for Solana monitoring
 * Our single Solana wallet receives both USDT and USDC
 */
export async function startSolanaMonitoring(
  ourWalletAddress: string,
  coin: string, // 'USDT' | 'USDC'
  orderId: string,
  expectedAmount: number
) {
  try {
    if (activeMonitors.has(orderId)) {
      console.warn(`Monitor already active for order ${orderId}`);
      return;
    }

    const { WS, RPC } = getSolanaRpcUrls();

    console.log(`🔍 Starting Solana monitoring on ${WS}`);
    console.log(
      `🎯 Watching for ${coin} payments to OUR SOLANA WALLET: ${ourWalletAddress}`
    );

    const connection = new Connection(RPC, {
      wsEndpoint: WS,
      commitment: "confirmed",
    });

    const owner = assertPubkey(ourWalletAddress, "OUR_SOLANA_WALLET");
    const mintAddr = assertPubkey(getSolanaMintFor(coin), `SOL_${coin}_MINT`);

    // Compute our Associated Token Account for the mint
    const ata = await getAssociatedTokenAddress(mintAddr, owner);
    // Get mint decimals dynamically (USDT/USDC are 6, but don’t assume)
    const mintInfo = await getMint(connection, mintAddr);
    const decimals = mintInfo.decimals ?? 6;

    const tolerance = 0.01; // 1% amount tolerance

    // Helper: inspect a signature → if it includes a token transfer to our ATA for the mint, and amount ≈ expectedAmount,
    // and is finalized, return a confirmation payload; else null.
    const inspectSignature = async (signature: string) => {
      // 'finalized' ensure it’s irreversible
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "finalized",
      });
      if (!tx || !tx.meta) return null;

      // postTokenBalances contain per account post-state amounts
      // Look for our ATA + correct mint and see delta vs preTokenBalances
      const pre = tx.meta.preTokenBalances || [];
      const post = tx.meta.postTokenBalances || [];

      // Build a map: accountIndex → { mint, owner, uiAmount }
      const preMap = new Map<
        string,
        { mint: string; owner?: string; uiAmount?: number | null }
      >();
      pre.forEach((b) => {
        preMap.set(String(b.accountIndex), {
          mint: b.mint,
          owner: (b as any).owner, // present in parsed
          uiAmount: b.uiTokenAmount?.uiAmount ?? undefined,
        });
      });

      for (const pb of post) {
        const accIdx = String(pb.accountIndex);
        const prev = preMap.get(accIdx);
        const isOurAta =
          pb.mint === mintAddr.toBase58() &&
          (pb.owner?.toLowerCase?.() === ourWalletAddress.toLowerCase() ||
            prev?.owner?.toLowerCase?.() === ourWalletAddress.toLowerCase());

        if (!isOurAta) continue;

        const before = prev?.uiAmount ?? 0;
        const after = pb.uiTokenAmount?.uiAmount ?? 0;
        const delta = after - before;

        if (delta > 0) {
          // check amount within tolerance
          const match =
            Math.abs(delta - expectedAmount) <= expectedAmount * tolerance;
          if (match) {
            return {
              confirmed: true,
              from: "unknown", // Solana parsed tx has account keys; can be extracted if needed
              to: ata.toBase58(), // our ATA (token account)
              transferredAmount: delta,
              confirmations: "finalized", // we requested finalized already
              coin,
              txHash: signature,
              blockchain: "Solana",
            };
          }
        }
      }
      return null;
    };

    const readUi = async () => {
      try {
        const b = await withRetry(() =>
          connection.getTokenAccountBalance(ata, "confirmed")
        );
        return b.value.uiAmount ?? 0;
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (
          msg.includes("could not find account") ||
          msg.includes("Invalid param")
        )
          return 0;
        throw e;
      }
    };

    let lastUi = 0;
    try {
      lastUi = await readUi();
    } catch {
      lastUi = 0;
    }

    const sub = connection.onAccountChange(
      ata,
      async (_acc: AccountInfo<Buffer>, _ctx: Context) => {
        try {
          const nowUi = await readUi();
          const delta = nowUi - lastUi;
          lastUi = nowUi;
          if (delta <= 0) return;

          const within =
            Math.abs(delta - expectedAmount) <= expectedAmount * 0.01;
          if (!within) return;

          // just fetch the newest signature; it's already finalized at this point
          const [sig] = await withRetry(() =>
            connection.getSignaturesForAddress(ata, { limit: 1 }, "finalized")
          );
          const signature = sig?.signature ?? "unknown";

          cleanupMonitor(orderId);
          await confirmCryptoPayment(
            {
              from: "unknown",
              to: ata.toBase58(),
              transferredAmount: delta,
              confirmations: "finalized",
              coin: coin as CoinSymbol,
              txHash: signature,
              blockchain: "Solana",
            },
            orderId
          );
        } catch (e: any) {
          if (e?.code !== "UND_ERR_CONNECT_TIMEOUT")
            console.error("Solana account watcher error:", e);
        }
      },
      { commitment: "finalized" }
    );

    // 10-minute expiry
    const expireTimer = setTimeout(async () => {
      try {
        await expireOrder(orderId);
        console.log(`⏰ Solana order ${orderId} expired - no payment received`);
      } catch (err) {
        console.error(`expireOrder failed for ${orderId}:`, err);
      } finally {
        cleanupMonitor(orderId);
      }
    }, 10 * 60 * 1000);

    // Register active monitor
    activeMonitors.set(orderId, {
      chain: "SOL",
      sub,
      conn: connection,
      timer: expireTimer,
    });
  } catch (err) {
    console.error("Error in Solana monitoring:", err);
    // best-effort cleanup
    try {
      cleanupMonitor(orderId);
    } catch {}
  }
}

function buildQuantumPaymentContext(
  order: any,
  input: ManualQuantumPaymentCheckInput
) {
  if (!order) {
    return { ok: false as const, status: 404, message: "Order not found" };
  }

  if (String(order.status) === String(OrderStatus.OrderCancelled)) {
    return { ok: false as const, status: 400, message: "Order is cancelled" };
  }

  const orderCoin = normalizeCoin(
    String(order?.currency || order?.breakdown?.inCurrenyName || "")
  );
  const inputCoin = normalizeCoin(input.paymentType);
  if (!orderCoin || !inputCoin || orderCoin !== inputCoin) {
    return {
      ok: false as const,
      status: 400,
      message: "Payment type does not match the order",
    };
  }

  const outCurrency = String(
    order?.breakdown?.outCurrencyName || ""
  ).toUpperCase();
  if (outCurrency !== "BTCY") {
    return {
      ok: false as const,
      status: 400,
      message: "Order is not a quantum BTCY crypto order",
    };
  }

  const expectedAmount = Number(order?.breakdown?.inAmount ?? 0);
  if (!amountsMatch(Number(input.amount), expectedAmount)) {
    return {
      ok: false as const,
      status: 400,
      message: "Amount does not match the order",
    };
  }

  const receiverAddress = String(
    order?.receiverAccount?.userReceiveAddress ||
      getOurWalletAddress(order?.blockchainName)
  ).trim();
  if (!receiverAddress) {
    return {
      ok: false as const,
      status: 500,
      message: "Order receiver address is missing",
    };
  }

  if (
    receiverAddress.toLowerCase() !==
    String(input.addressPaidTo || "")
      .trim()
      .toLowerCase()
  ) {
    return {
      ok: false as const,
      status: 400,
      message: "Address paid to does not match the order",
    };
  }

  const blockchain = String(order?.blockchainName || "");
  if (blockchain !== "Ethereum" && blockchain !== "Solana") {
    return {
      ok: false as const,
      status: 400,
      message: "Unsupported blockchain on order",
    };
  }

  return {
    ok: true as const,
    coin: orderCoin,
    expectedAmount,
    receiverAddress,
    blockchain,
  };
}

export async function verifyQuantumCryptoPayment(
  orderId: string,
  input: ManualQuantumPaymentCheckInput
) {
  try {
    const order = await orderService.findOne({ orderId });
    if (!order) {
      return {
        status: 404,
        data: {
          orderId,
          paymentReceived: false,
          message: "Order not found",
        },
      };
    }

    if (input.txHash) {
      const duplicate = await findDuplicateTxHash(input.txHash, orderId);
      if (duplicate) {
        return {
          status: 409,
          data: {
            orderId,
            paymentReceived: false,
            message: "Transaction hash already used for another order",
            txHash: input.txHash,
            existingOrderId: duplicate.orderId || null,
          },
        };
      }
    }

    if (String(order?.status) === String(OrderStatus.Completed)) {
      return {
        status: 200,
        data: {
          orderId,
          paymentReceived: true,
          status: OrderStatus.Completed,
          message: "Order already completed",
        },
      };
    }

    const context = buildQuantumPaymentContext(order, input);
    if (!context.ok) {
      return {
        status: context.status,
        data: { orderId, paymentReceived: false, message: context.message },
      };
    }

    const retryMs = input.retryMs ?? MANUAL_CHECK_RETRY_MS;
    const retryIntervalMs = input.retryIntervalMs ?? MANUAL_CHECK_INTERVAL_MS;
    const deadline = Date.now() + retryMs;
    let attempts = 0;

    do {
      attempts += 1;
      const detected = await detectQuantumPayment(
        order,
        context.coin,
        context.expectedAmount,
        context.receiverAddress,
        input.txHash
      );

      if (detected?.txHash) {
        const duplicate = await findDuplicateTxHash(detected.txHash, orderId);
        if (duplicate) {
          return {
            status: 409,
            data: {
              orderId,
              paymentReceived: false,
              message: "Transaction hash already used for another order",
              txHash: detected.txHash,
              existingOrderId: duplicate.orderId || null,
            },
          };
        }
      }

      if (detected) {
        const confirmation = await confirmCryptoPayment(detected, orderId);
        return {
          status: confirmation.success
            ? 200
            : confirmation.duplicateTxHash
            ? 409
            : 500,
          data: {
            orderId,
            paymentReceived: confirmation.success,
            message: confirmation.message,
            ...(confirmation.data || {}),
            ...(confirmation.duplicateTxHash
              ? { existingOrderId: confirmation.existingOrderId || null }
              : {}),
          },
        };
      }

      if (input.txHash) {
        break;
      }

      if (Date.now() + retryIntervalMs > deadline) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    } while (Date.now() < deadline);

    return {
      status: 200,
      data: {
        orderId,
        paymentReceived: false,
        status: order?.status || OrderStatus.Pending,
        attempts,
        message: "Payment not received",
      },
    };
  } catch (err: any) {
    console.error("verifyQuantumCryptoPayment error:", err);
    return {
      status: 500,
      data: {
        orderId,
        paymentReceived: false,
        message: err?.message || "Failed to verify payment",
      },
    };
  }
}

export async function verifyQuantumCryptoPaymentByTxHash(
  orderId: string,
  txHash: string
) {
  const order = await orderService.findOne({ orderId });
  const input = {
    paymentType:
      normalizeCoin(
        String(order?.currency || order?.breakdown?.inCurrenyName || "")
      ) || "USDT",
    amount: Number(order?.breakdown?.inAmount ?? 0),
    addressPaidTo: String(order?.receiverAccount?.userReceiveAddress || ""),
    txHash,
    retryMs: 0,
  } as ManualQuantumPaymentCheckInput;

  return verifyQuantumCryptoPayment(orderId, input);
}

export async function cancelQuantumCryptoOrder(orderId: string) {
  try {
    const order = await orderService.findOne({ orderId });
    if (!order) {
      return { status: 404, data: { orderId, message: "Order not found" } };
    }

    if (String(order.status) === String(OrderStatus.Completed)) {
      return {
        status: 400,
        data: { orderId, message: "Completed orders cannot be cancelled" },
      };
    }

    if (String(order.status) === String(OrderStatus.OrderCancelled)) {
      return {
        status: 200,
        data: {
          orderId,
          status: OrderStatus.OrderCancelled,
          message: "Order already cancelled",
        },
      };
    }

    stopMonitoringForOrder(orderId);

    await orderService.updatePart(
      { orderId },
      {
        $set: {
          status: OrderStatus.OrderCancelled,
          orderCompletedOn: new Date(),
        },
      }
    );

    await emitToOrderUser(orderId, "order:cancelled", {
      orderId,
      status: OrderStatus.OrderCancelled,
    });
    await emitToOrderUser(orderId, "orders:update", {
      orderId,
      status: OrderStatus.OrderCancelled,
    });

    return {
      status: 200,
      data: {
        orderId,
        status: OrderStatus.OrderCancelled,
        message: "Order cancelled successfully",
      },
    };
  } catch (err: any) {
    console.error("cancelQuantumCryptoOrder error:", err);
    return {
      status: 500,
      data: {
        orderId,
        message: err?.message || "Failed to cancel order",
      },
    };
  }
}

/**
 * Confirm PayPal payment
 */
export async function confirmPayPalPayment(
  orderId: string,
  paypalTransactionId: string,
  paypalStatus: string
) {
  try {
    if (!orderId || !paypalTransactionId) {
      return {
        success: false,
        message: "OrderId and paypalTransactionId are required",
      };
    }

    const order = await orderService.findOne({ orderId: orderId });

    if (!order) {
      return { success: false, message: "Order not found" };
    }

    // Note: Since Order model doesn't have paymentMethod, we'll store it in breakdown or comments
    // For now, let's assume PayPal orders have specific characteristics

    // Verify PayPal payment
    if (paypalStatus === "completed") {
      // Create transaction record
      await txService.create({
        email: order.user.email,
        orderId: orderId,
        extRef: paypalTransactionId,
        txId: paypalTransactionId,
        from: "PayPal",
        to: "PaymentProcessor",
        amount: order.breakdown.inAmount,
        info: "PayPal Payment Received",
        status: OrderStatus.Completed,
        currencyRef: Currency.USD,
        exchangeName: "PaymentProcessor",
        walletType: "PAYPAL",
        transactionType: "PAYPAL_PAYMENT",
        txDate: new Date(),
        benificaryAddress: "",
      });

      // Create order transaction
      const orderTransaction: OrderTransaction = {
        currency: Currency.USD,
        amount: order.breakdown.inAmount,
        trnReference: paypalTransactionId,
        trnHash: paypalTransactionId,
        walletAddress: "PayPal",
        created: new Date(),
        status: "Completed",
      };

      // Update order to completed
      await orderService.updatePart(
        { orderId: orderId },
        {
          $set: {
            status: OrderStatus.Completed,
            orderCompletedOn: new Date(),
            transactions: order.transactions?.concat(orderTransaction) || [
              orderTransaction,
            ],
          },
        }
      );

      return {
        success: true,
        message: "PayPal payment confirmed successfully",
      };
    } else {
      return { success: false, message: "PayPal payment not completed" };
    }
  } catch (err) {
    console.error("Error confirming PayPal payment:", err);
    return { success: false, message: "Internal server error", error: err };
  }
}

/**
 * Get order status
 */
export async function getOrderStatus(orderId: string) {
  try {
    const order = await orderService.findOne({ orderId: orderId });

    if (!order) {
      return { success: false, message: "Order not found" };
    }

    return {
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        amount: order.breakdown.inAmount,
        currency: order.currency,
        createdOn: order.created,
        completedOn: order.orderCompletedOn,
        transactions: order.transactions,
      },
    };
  } catch (err) {
    console.error("Error getting order status:", err);
    return { success: false, message: "Internal server error", error: err };
  }
}
