import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { ethers } from "ethers";
import { keys } from "../config/keys";
import { getPriceByName } from "../controllers/priceAPI";
import { CurrencyService } from "./currency.service";

export interface SendStablecoinResult {
  success: boolean;
  txHash?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

const isDev = true;
const DEVNET_RPC = isDev
  ? keys.SOLANA_DEV_RPC_URL?.key
  : keys.SOLANA_MAIN_RPC_URL?.key;
const connection = new Connection(DEVNET_RPC, "confirmed");
const currencyService = new CurrencyService();

// UPDATED: Using your specific environment variables

export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
export const DEVNET_USDT_MINT = new PublicKey(
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);

function getCompanyKeypair(): Keypair {
  const secretKeyString = keys.PERSONAL_SELL_WALLET_SOL.key;

  if (!secretKeyString) {
    throw new Error("PERSONAL_SELL_WALLET_SOL missing from .env");
  }

  const secretKey = bs58.decode(secretKeyString);
  return Keypair.fromSecretKey(secretKey);
}

export async function sendStablecoinToUserSolana(
  userWalletAddress: string,
  amount: number,
  currency: string
): Promise<SendStablecoinResult> {
  try {
    const companyKeypair = getCompanyKeypair();

    // IF AN ETH ADDRESS IS PASSED HERE, IT THROWS THE "Non-base58 character" ERROR
    const userPubkey = new PublicKey(userWalletAddress);

    const mintAddress =
      currency.toUpperCase() === "USDC" ? DEVNET_USDC_MINT : DEVNET_USDT_MINT;

    try {
      const mintInfo = await getMint(connection, mintAddress);
      const decimals = mintInfo.decimals;
      const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

      const companyTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        companyKeypair,
        mintAddress,
        companyKeypair.publicKey
      );

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        companyKeypair,
        mintAddress,
        userPubkey
      );

      const ix = createTransferInstruction(
        companyTokenAccount.address,
        userTokenAccount.address,
        companyKeypair.publicKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      );

      const tx = new Transaction().add(ix);
      const txHash = await sendAndConfirmTransaction(connection, tx, [
        companyKeypair,
      ]);

      return { success: true, txHash, amount, currency };
    } catch (splErr) {
      console.warn(
        `[devnet] SPL transfer failed, falling back to SOL. Error: ${splErr}`
      );
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: companyKeypair.publicKey,
          toPubkey: userPubkey,
          lamports,
        })
      );
      const txHash = await sendAndConfirmTransaction(connection, tx, [
        companyKeypair,
      ]);

      return {
        success: true,
        txHash,
        amount,
        currency: `${currency}(SOL-fallback)`,
      };
    }
  } catch (err: any) {
    console.error("[sendStablecoinToUserSolana] error:", err);
    return { success: false, error: String(err) };
  }
}

const ETH_RPC_URL = isDev ? keys.ETH_RPC_TEST?.key : keys.ETH_RPC_MAIN?.key;
const BSC_RPC_URL = isDev
  ? keys.BSC_RPC_TEST?.key || keys.QUICKNODE_BNB_TEST?.key
  : keys.BSC_RPC_MAIN?.key || keys.QUICKNODE_BNB_MAIN?.key;

// Make sure your provider throws a helpful error if the URL is missing
if (!ETH_RPC_URL) {
  console.error("Missing ETH_RPC_URL in environment keys!");
}
if (!BSC_RPC_URL) {
  console.error("Missing BSC_RPC_URL in environment keys!");
}
// UPDATED: Using your specific EVM environment variable
const ETH_PRIVATE_KEY = keys.PERSONAL_SELL_WALLET_ETH.key || "";

// Standard ERC20 ABI for transfers
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Provide your actual Smart Contract Addresses here
const ETH_USDC_ADDRESS =
  process.env.ETH_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Example Sepolia USDC
const ETH_USDT_ADDRESS = process.env.ETH_USDT_ADDRESS || "0x..."; // Your USDT address

type EvmSellNetwork = "ethereum" | "binance";

function resolveEvmNetworkConfig(network: EvmSellNetwork) {
  if (network === "binance") {
    return {
      rpcUrl: BSC_RPC_URL,
      usdcAddress: BSC_USDC_ADDRESS,
      usdtAddress: BSC_USDT_ADDRESS,
    };
  }

  return {
    rpcUrl: ETH_RPC_URL,
    usdcAddress: ETH_USDC_ADDRESS,
    usdtAddress: ETH_USDT_ADDRESS,
  };
}

export async function sendStablecoinToUserEVM(
  userWalletAddress: string,
  amount: number,
  currency: string,
  network: EvmSellNetwork = "ethereum"
): Promise<SendStablecoinResult> {
  console.log("currency", currency);

  try {
    if (!ETH_PRIVATE_KEY)
      throw new Error("PERSONAL_SELL_WALLET_ETH missing from .env");

    const cfg = resolveEvmNetworkConfig(network);
    if (!cfg.rpcUrl) {
      throw new Error(`Missing RPC URL for ${network} network`);
    }

    const provider = new ethers.providers.JsonRpcProvider(cfg.rpcUrl);
    const wallet = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

    const tokenAddress =
      currency.toUpperCase() === "USDC" ? cfg.usdcAddress : cfg.usdtAddress;
    if (!tokenAddress || tokenAddress === "0x...") {
      throw new Error(
        `Missing ${currency.toUpperCase()} contract address for ${network} network`
      );
    }
    console.log("", tokenAddress);

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    const decimals = await contract.decimals();
    console.log(decimals);

    const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
    const tx = await contract.transfer(userWalletAddress, parsedAmount);

    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.hash,
      amount,
      currency,
    };
  } catch (err: any) {
    console.error("[sendStablecoinToUserEVM] error:", err);
    return { success: false, error: err.message || String(err) };
  }
}

const BSC_USDC_ADDRESS = process.env.BSC_USDC_ADDRESS || "";
const BSC_USDT_ADDRESS = process.env.BSC_USDT_ADDRESS || "";

export async function sendStablecoinToUserBinance(
  userWalletAddress: string,
  amount: number,
  currency: string
): Promise<SendStablecoinResult> {
  try {
    if (!BSC_RPC_URL) {
      throw new Error("BSC_RPC_URL missing from .env");
    }
    if (!ETH_PRIVATE_KEY) {
      throw new Error("PERSONAL_SELL_WALLET_ETH missing from .env");
    }

    const tokenAddress =
      currency.toUpperCase() === "USDC" ? BSC_USDC_ADDRESS : BSC_USDT_ADDRESS;
    if (!tokenAddress) {
      throw new Error(`BSC_${currency.toUpperCase()}_ADDRESS missing from .env`);
    }

    const provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
    const wallet = new ethers.Wallet(ETH_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const decimals = await contract.decimals();
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
    const tx = await contract.transfer(userWalletAddress, parsedAmount);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.transactionHash || receipt.hash,
      amount,
      currency,
    };
  } catch (err: any) {
    console.error("[sendStablecoinToUserBinance] error:", err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function getBtcyToStablecoinRate(): Promise<number> {
  try {
    console.log("[getBtcyToStablecoinRate] trying live BTCY price via getPriceByName");
    const priceResult = await getPriceByName("BTCY");
    const rate = Number(priceResult?.data);
    console.log("[getBtcyToStablecoinRate] live BTCY price result", {
      status: priceResult?.status,
      data: priceResult?.data,
      parsedRate: rate,
    });

    if (priceResult?.status === 200 && Number.isFinite(rate) && rate > 0) {
      console.log("[getBtcyToStablecoinRate] using live BTCY price", rate);
      return rate;
    }
  } catch (err: any) {
    console.warn("[getBtcyToStablecoinRate] live BTCY price lookup threw", {
      message: err?.message || String(err),
      name: err?.name,
      code: err?.code,
      stack: err?.stack,
    });
  }

  const configuredBtcyPrice =
    (await currencyService.findOne({ code: "BTCY", type: "BUY" })) ||
    (await currencyService.findOne({ code: "BTCY" }));
  const configuredRate = Number(configuredBtcyPrice?.buyPrice);
  console.log("[getBtcyToStablecoinRate] configured BTCY DB price result", {
    found: !!configuredBtcyPrice,
    id: (configuredBtcyPrice as any)?._id,
    code: configuredBtcyPrice?.code,
    type: configuredBtcyPrice?.type,
    buyPrice: configuredBtcyPrice?.buyPrice,
    parsedRate: configuredRate,
  });

  if (Number.isFinite(configuredRate) && configuredRate > 0) {
    console.log("[getBtcyToStablecoinRate] using configured BTCY DB price", configuredRate);
    return configuredRate;
  }

  const rawEnvRate =
    process.env.BTCY_USD_PRICE ||
    process.env.BTCY_PRICE_USD ||
    process.env.BTCY_TO_STABLECOIN_RATE;
  const envRate = Number(rawEnvRate);
  console.log("[getBtcyToStablecoinRate] env BTCY price result", {
    hasEnvRate: rawEnvRate != null && String(rawEnvRate).trim() !== "",
    rawEnvRate,
    parsedRate: envRate,
  });
  if (Number.isFinite(envRate) && envRate > 0) {
    console.log("[getBtcyToStablecoinRate] using env BTCY price", envRate);
    return envRate;
  }

  console.error("[getBtcyToStablecoinRate] unable to resolve BTCY price from all sources");
  throw new Error("Unable to resolve BTCY price");
}
