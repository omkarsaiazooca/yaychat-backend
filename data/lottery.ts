import { UserLite } from "./user";

export interface Ticket {
  name: string;
  lotteryId: string;
  totalTickets: number;
  ticketNumbers: TicketNumbers[];
  email: string;
  userType: string; // CaptainBee | HoneyBee | WebWallet | Normal
  ticketBuyDate: Date;
  isWinner: boolean;
  buyCurrency: String;
  buyAmount: string;
  totalCost: string;
  discountCode: string;
  discountAmount: string;
  finalAmountAfterdiscount: string;
  orderId: string;
}

export interface Lottery {
  name: string;
  type: string; //"crypto" | "phyiscalAsset"
  uniqueCode: string;
  coinName: string;
  assetType: string;
  images: string[];
  maximumWinners: number;
  status: "open" | "closed" | "completed" | "comingsoon";
  price: number;
  prizePool: number[];
  tickets: Ticket[];
  winningTicket: TicketNumbers[];
  drawDate: Date; // ISO date string
  openDate: Date;
  closeDate: Date;
  openedAdminEmail: string;
  createdBy?: string; // Admin User ID who created the lottery
  updatedBy?: string; // Admin User ID who last updated the lottery
  winners?: UserLite[]; // Array of lite user objects for winners
  participantsCount?: number; // Total number of participants
  maximumTickets?: number;
  description: string;
  prizePoolDetails?:number[]; 
}

export interface TicketNumbers {
  id: number;
  ticketNumbers: string[];
  isWinningTicket: boolean;
}

export interface UserCartTicket {
  lotteryId: string;
  userType?: string;
  cartId: string;
  email: string;
  tickets: TicketNumbers[];
  updatedAt: Date;
  price?: any;
}
