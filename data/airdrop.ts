import { IDocumentModel, IModel } from "./base";

export interface Airdrop extends IModel, IDocumentModel<Airdrop> {
   userType: string;
   createdDate: Date;
   email: string;
   walletAddress: string;
   walletProvider: string;
   transactionHash: string;
   airdropAmount: number;
   tokenName: string;
   status: string; //'pending' | 'completed' | 'failed';
   network: string;
   airdropDate?: Date;
   notes?: string;
   eventType?: string;
   coinPrice?: string;
   referralCode?: string;  // this is code of the user who referred this user
}
