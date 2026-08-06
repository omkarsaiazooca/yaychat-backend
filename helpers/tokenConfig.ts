// tokenConfig.ts
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const TOKENS = {
  USDC: {
    mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    programId: TOKEN_PROGRAM_ID,
    decimals: 6,
  },
  USDT: {
    mint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    programId: TOKEN_PROGRAM_ID,
    decimals: 6,
  },
};
