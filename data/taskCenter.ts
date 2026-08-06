import { IDocumentModel, IModel } from "./base";

export interface pointHistoryObj {
  email: string;
  points: number;
  type: string; // "SignUp_Points || KYC_Points || BuyIndexxToken_Points || OneTransactionCompleted_Points || BugReported_Points || InvitedUserPoints "
  date: Date;
}
export interface TaskCenter extends IModel, IDocumentModel<TaskCenter> {
  email: string;
  totalPoints: number;
  redeemPoints: number;
  inivitedUsersCount: number;
  inivitedUsersEmail: string[];
  isInivitedThreeUsers: boolean;
  inivitedUserPoints: number;
  isReportedBug: boolean;
  reportedBugPoints: number;
  remainingPoints: number;
  isTransactionCompletedInExchange: boolean;
  transactionPoints: number;
  lottoPoints: number;
  isParticipatedInLotto: boolean;
  KYCPoints: number;
  isKYCPass?: boolean;
  tradeToEarnPercentage?: number;
  isBuyIndexxTokens: boolean;
  buyIndexxTokensPoints: number;
  isSignUp: boolean;
  signUpPoints: number;
  pointsHistory: pointHistoryObj[];
}

export const inivitedUserPointsPerUser = 10;
export const reportedBugPoints = 30;
export const transactionPoints = 30;
export const lottoPoints = 10;
export const KYCPoints = 20;
export const buyIndexxTokensPoints = 20;
export const signUpPoints = 10;
export const tradeToEarnPercentage = 10;

/*
 email: String,
    totalPoints: Number,
    redeemPoints: Number,
    inivitedUsersCount: Number,
    isInivitedThreeUsers: Boolean,
    inivitedUserPoints: Number,
    isReportedBug: Boolean,
    reportedBugPoints: Number,
    remainingPoints: Number,
    isTransactionCompletedInExchange: Boolean,
    transactionPoints: Number,
    isParticipatedInLotto: Boolean,
    lottoPoints: Number
*/
