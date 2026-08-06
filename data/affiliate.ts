import { User } from "./user";

export interface PayoutDetail {
  amount: Number,
  payoutType: String,
  date: Date,
  method: String,
  status: String,
  notes: String
}

export interface Affiliate {
  firstname: string;
  lastname: string;
  Username: string;
  Email: string;
  ssn: string;
  code: string;
  Phone: string;
  country: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  Zip: string;
  password: string;
  confirmpass: string;
  Currency: string;
  photoIdFileurl: string;
  frontFileurl: string;
  backFileurl: string;
  isEmailPublic: boolean;
  PublicBio: string;
  isPhonePublic: boolean;
  accname: string;
  Website: string;
  protocol: string;
  userData?: User;
  permissionsGiven: {
    // Count of permissions given by Honey Bees
    buy: number;
    sell: number;
    convert: number;
  };
  // Affiliate Statistics
  totalTransactions: number; // Total number of transactions facilitated
  totalHoneyBeeVolume: number; // Total volume/amount facilitated in transactions
  totalCaptainBeeVolume: number; // Total volume/amount facilitated in transactions
  honeyBeeCount: number; // Total number of Honey Bees associated
  latestTransactionDate?: Date; // Last date of transaction facilitated
  orderCount: number;
  captainOrderCount: number;
  // MLM-specific Properties
  referralCodeUsed?: string; // ID of the affiliate's sponsor
  totalDownlineCount: number; // Total number of downline members
  level: number; // Current MLM level of the affiliate
  rewardsEarned: {
    levelRewards: number; // Rewards earned at the current level
    bonusRewards: number; // Bonus rewards earned
  };

  honeyBees: string[];
  captainBees: string[];
  accountCreationDate?: string;
  socialMediaLink: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    pinterest?: string;
    snapchat?: string;
    tiktok?: string;
    discord?: string;
  };
  rank: string;
  familyRank: string;
  commissionPercentage: number;
  totalCommissionEarned: {
    amountInUSD: number;
    amountInINEX: number;
  };
  totalCommissionToBePaid: {
    amountInUSD: number;
    amountInINEX: number;
  };
  totalHoneyBeeCommissionEarned: {
    amountInUSD: number;
    amountInINEX: number;
  };
  totalHoneyBeeCommissionToBePaid: {
    amountInUSD: number;
    amountInINEX: number;
  };
  greetingCards: GreetingCard[];
  adminAccepted?: boolean;
  isNormalUser?: boolean;
}

export interface GreetingCard {
  title: string;
  message: string;
  senderEmail: string;
  receiverEmail: string;
  occasion: string; 
  sendDate: Date;
  imageUrl?: string;
  isUsed: boolean;
  isActive: boolean;
  code: string;
  numberOfTokens: number;
  tokenSymbol: string;
  tokenName: string;
  userType: string;
  receiverActivatedDate: Date
}