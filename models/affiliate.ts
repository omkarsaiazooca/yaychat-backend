import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { Affiliate, GreetingCard, PayoutDetail } from "../data/affiliate";

export interface AffiliateModel extends IDocumentModel<Affiliate>, Affiliate {}
export interface GreetingCardDocument extends Document, GreetingCard {}

const payoutDetailSchema = new Schema<PayoutDetail>({
  amount: Number,
  date: Date,
  method: String,
  status: String,
  notes: String,
});

const greetingCardSchema = new Schema<GreetingCardDocument>({
  title: String,
  message: String,
  senderEmail: String,
  receiverEmail: String,
  occasion: String,
  sendDate: Date,
  imageUrl: String,
  isUsed: Boolean,
  isActive: Boolean,
  code: String,
  numberOfTokens: Number,
  userType: String,
  tokenSymbol: { type: String, default: "INEX" },
  tokenName: { type: String, default: "Indexx Exchange" },
  receiverActivatedDate: Date,
});

var affiliateSchema: Schema = new Schema();

affiliateSchema.add({
  firstname: String,
  lastname: String,
  Username: String,
  Email: String,
  ssn: String,
  code: String,
  Phone: String,
  isPhonePublic: { type: Boolean, default: false },
  isEmailPublic: { type: Boolean, default: false },
  country: String,
  address1: String,
  address2: String,
  city: String,
  state: String,
  Zip: String,
  password: String,
  confirmpass: String,
  Currency: String,
  photoIdFileurl: String,
  frontFileurl: String,
  backFileurl: String,
  accname: String,
  Website: String,
  protocol: String,
  PublicBio: String,
  totalTransactions: Number, // Total number of transactions facilitated
  totalHoneyBeeVolume: Number, // Total volume/amount facilitated in transactions
  totalCaptainBeeVolume: Number, // Total volume/amount facilitated in transactions
  honeyBeeCount: Number, // Total number of Honey Bees associated
  latestTransactionDate: Date, // Last date of transaction facilitated
  permissionsGiven: {
    // Count of permissions given by Honey Bees
    buy: Number,
    sell: Number,
    convert: Number,
  },
  honeyBees: [{ type: String, default: [""] }],
  captainBees: [{ type: String, default: [""] }],
  socialMediaLink: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String,
    youtube: String,
    pinterest: String,
    snapchat: String,
    tiktok: String,
    discord: String,
  },
  orderCount: Number,
  captainOrderCount: Number,
  // MLM-specific Properties
  referralCodeUsed: String, // ID of the affiliate's sponsor
  totalDownlineCount: Number, // Total number of downline members
  level: Number, // Current MLM level of the affiliate
  rewardsEarned: {
    levelRewards: Number, // Rewards earned at the current level
    bonusRewards: Number, // Bonus rewards earned
  },
  rank: String,
  familyRank: String,
  commissionPercentage: Number,
  totalCommissionEarned: {
    amountInUSD: Number,
    amountInINEX: Number,
  },
  totalCommissionToBePaid: {
    amountInUSD: Number,
    amountInINEX: Number,
  },
  totalHoneyBeeCommissionEarned: {
    amountInUSD: Number,
    amountInINEX: Number,
  },
  totalHoneyBeeCommissionToBePaid: {
    amountInUSD: Number,
    amountInINEX: Number,
  },
  greetingCards: {
    type: [greetingCardSchema],
    default: [], // Setting the default value as an empty array
  },
  payouts: {
    type: [payoutDetailSchema],
    default: [], // Initialize as an empty array
  },
  adminAccepted: {
    type: Boolean,
    default: false,
  },
  isNormalUser: {
    type: Boolean,
    default: false,
  },
});

export default affiliateSchema;
