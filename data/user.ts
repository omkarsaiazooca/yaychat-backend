import { boolean } from "is_js";
import { IDocumentModel, IModel } from "./base";
import { Address, AuthProviders, IAccountDetails, Languages } from "./common";
import { Lottery, Ticket } from "./lottery";
import { Reward } from "./reward";
import { Transaction } from "./transaction";

export enum UserRoleTypes {
  Standard = "Standard",
  Admin = "Admin",
  SuperAdmin = "SuperAdmin",
  CustomerSupport = "CustomerSupport",
}

export interface UserLite {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRoleTypes;
  isVerified: boolean;
  language: string;
  profilePhoto: string;
}

export interface UserAuthProvider {
  provider: AuthProviders;
  phash?: string;
  psalt?: string;
}

export interface UserVerification {
  activated: boolean;
  activatedOn: Date;

  emailVerified: boolean;
  emailVerifiedOn: Date;
  emailCode: string;
  emailCodeExpiry: Date;

  phoneVerified: boolean;
  phoneVerifiedOn: Date;
  phoneCode: string;
  phoneCodeExpiry: Date;

  photoVerified: boolean;
  photoVerifiedOn: Date;

  addressVerified: boolean;
  addressVerifiedOn: Date;

  currencyUpdated: boolean;
  currencyUpdatedOn: Date;

  emailDeliverability?: {
    status?: string;
    subStatus?: string;
    provider?: string;
    checkedAt?: Date;
    didYouMean?: string | null;
    account?: string;
    domain?: string;
  };
}

export interface Permissions {
  buy: boolean;
  buyApprovedOn: Date; // Date when Honey Bee approved Captain Bee
  sell: boolean;
  sellApprovedOn: Date; // Date when Honey Bee approved Captain Bee
  convert: boolean;
  convertApprovedOn: Date; // Date when Honey Bee approved Captain Bee
}

export interface BeeRelationship {
  honeybeeEmail: string; // ID of the Honey Bee
  captainBeeEmail: string; // ID of the Captain Bee
  permissions: Permissions; // Permissions granted by Honey Bee to Captain Bee
}

export interface CaptainBeeRelationship {
  mainCaptainBeeEmail: string; // Email of the Main Captain Bee
  captainBeeEmail: string; // Email of the Captain Bee
  permissions: Permissions; // Permissions granted by Honey Bee to Captain Bee
}

export interface User extends IModel, IDocumentModel<User> {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  walletAddress: string;
  isPhonePublic: boolean;
  isEmailPublic: boolean;
  language: Languages;
  userType: string;
  role: UserRoleTypes;
  basic: UserLite;
  country: string;
  userRiskLevel: string;
  authProviders: UserAuthProvider[];
  verification: UserVerification;
  accounts: IAccountDetails[];
  address: Address;
  baseCurrency: string;
  referralCodeUsed: string;
  userWallets: UserWallet[];
  freeTrailUserWallets: UserWallet[];
  userRewards: Reward;
  lastLogin: Date;
  vipLevel: string;
  kycStatus: string;
  KYCUpdatedDate?: Date;
  isKYCPass: boolean;
  isParticipatedInGroupReward?: boolean;
  referralCode: string;
  favouriteCurrencies: string[];
  userMnemonic?: string;
  password?: string;
  relationships: BeeRelationship[];
  captainBeeRelationShips: CaptainBeeRelationship[];
  profilePic: string;
  bio?: string;
  accountCreationDate: any;
  referredUserData?: any;
  ownedTickets?: Ticket[]; // Tickets that the user has purchased
  wonLotteries?: Lottery[];
  coinClaims?: CoinClaim[];
  personalIdNumber?: string;
  isTestFundActive?: boolean;
  isWithdrawRestricted?: boolean;
  isFreeTrailEnded?: boolean;
  freeTrailStartDate?: Date;
  freeTrailEndDate?: Date;
  BTCYAcknowledgementStatus?: boolean;
  BTCYAcknowledgementDate?: Date;
  BTCYMigrationStatus?: "", //'In Queue' | 'Completed' | 'Not Started' }
  BTCYMigrationDate?: Date,
  tutorialWatched?: boolean;
  UserPrivacyBTCYAppSettings?: UserPrivacySettings;
  fcmToken?: string,
  deviceType?: string,
  deviceModel?: string, // Optional
  osVersion?: string, // Optional
  lastActive?: Date,
  brand?: string, // Optional
  uniqueId?: string, // Optional
  mutedChatIds?: string[], // Array of chat/group IDs that are muted
  nuggetBalance?: number;
}

export interface UserPrivacySettings {
  hideRealName: boolean;
  hideBalance: boolean;
  pushNotifications: boolean;
}


export interface AdminUser extends User { }

export interface UserWallet {
  userId: string;
  coinType: string;
  coinWalletAddress: string;
  coinPrivateKey: string;
  coinNetwork: string;
  coinName: string;
  coinSymbol: string;
  coinDecimals: number;
  coinStakedBalance: number,
  coinBalance: number;
  coinBalanceInUSD: number;
  coinBalanceInBTC: number;
  coinCreatedOn: Date;
  coinLastUsedOn: Date;
  coinPrice: number;
  coinPrevPrice: number;
  isCoinActive: boolean;
  transactions?: Transaction[];
  notes?: string;
  specialNotes?: string;
  amountInvested?: number
}


export interface CoinClaim {
  coinName: string;
  coinNetwork: string;
  coinSymbol: string;
  totalFreeCoins: number;
  claimedDate: Date;
  claimStatus: string; // "Pending", "Completed")
  userId: string;
  transactionId?: string;
}
