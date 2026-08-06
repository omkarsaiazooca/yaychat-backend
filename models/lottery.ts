import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Lottery, Ticket, UserCartTicket } from "../data/lottery";

export interface LotteryModel extends IDocumentModel<Lottery>, Lottery {}
export interface TicketModel extends IDocumentModel<Ticket>, Ticket {}
export interface UserCartTicketModel
  extends IDocumentModel<UserCartTicket>,
    UserCartTicket {}

const TicketSchema: Schema = new Schema({
  id: Number,
  ticketNumbers: [String],
  isWinningTicket: { type: Boolean, default: false },
});

export const TicketLotterySchema: Schema = new Schema(
  {
    name: { type: String },
    lotteryId: { type: String },
    totalTickets: { type: Number },
    ticketNumbers: { type: [TicketSchema] },
    email: { type: String },
    userType: {
      type: String,
      //enum: ["CaptainBee", "HoneyBee", "WebWallet", "NormalUser"],
    },
    ticketBuyDate: { type: Date },
    isWinner: { type: Boolean },
    buyCurrency: { type: String },
    buyAmount: { type: String },
    totalCost: { type: String },
    discountCode: { type: String },
    discountAmount: { type: String },
    finalAmountAfterdiscount: { type: String },
    orderId: { type: String },
  },
  { timestamps: true }
);

export const LotterySchema: Schema = new Schema(
  {
    name: { type: String },
    type: { type: String }, //"crypto" | "phyiscalAsset"
    uniqueCode: { type: String },
    coinName: { type: String },
    assetType: { type: String },
    maximumWinners: { type: Number },
    images: { type: [String] },
    status: {
      type: String,
      enum: ["open", "closed", "completed", "comingsoon"],
    },
    price: { type: Number },
    prizePool: { type: [Number] },
    prizePoolDetails:{ type: [Number] },
    tickets: [TicketLotterySchema],
    winningTicket: { type: [TicketSchema] },
    drawDate: { type: Date },
    openDate: { type: Date },
    closeDate: { type: Date },
    openedAdminEmail: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
    winners: [
      {
        userId: String,
        email: String,
        firstName: String,
        lastName: String,
        role: String,
        isVerified: Boolean,
        language: String,
        profilePhoto: String,
      },
    ],
    participantsCount: { type: Number, default: 0 },
    maximumTickets: { type: Number, default: 600 },
    description: { type: String },
  },
  { timestamps: true }
);

export const UserCartTicketSchema: Schema = new Schema(
  {
    lotteryId: { type: String },
    userType: { type: String },
    cartId: { type: String },
    email: { type: String },
    tickets: { type: [TicketSchema] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
