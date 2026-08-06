import { IDocumentModel, IModel } from "./base";

export interface BTCYTronAirdropUser extends IModel, IDocumentModel<BTCYTronAirdropUser> {
  email: string;
  walletAddress?: string;
  walletProvider?: string;
  network?: string;
  status?: string;
  airdropAmount?: number;
  txHash?: string;
  createdDate?: Date;
  airdropDate?: Date;
  tokenName?: string;
  eventType?: string;
  referralCode?: string;
  totalMined?: number;
  miningPlan?: string;
  miningRate?: number;
  isMiningActive?: boolean;
  lastClaimTime?: Date;
  source?: string;
  isWinner?: boolean;
  isWinnerPopupSeen?: boolean;
  tronRegistered?: boolean;
  turboClaimed?: boolean;
  turboClaimedAt?: Date;
  turboExpiresAt?: Date;
}
