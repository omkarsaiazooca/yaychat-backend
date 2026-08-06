import { OrderStatus } from "./order";

export interface XNFTTransaction {
  txId: string;
  from?: string;
  to?: string;
  amount: number;
  info?: string;
  status: OrderStatus;
  currencyRef: String;
  walletType: String;
  transactionType: String;
  exchangeName: String;
  email?: string;
  userWalletAddress: string;
  txDate: Date;
  blockchain: string;
  contractAddress: string;
  tokenId: string;
  type: string;
  isINEXConvert: boolean;
}