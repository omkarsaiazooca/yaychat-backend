import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { TaskCenter } from "../data/taskCenter";

export interface TaskCenterModel
  extends IDocumentModel<TaskCenter>,
    TaskCenter {}
const taskCenterSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var taskCenterSchema: Schema = new Schema({}, taskCenterSchemaOptions);

export var pointHistoryObj: Schema = new Schema(
  {
    email: String,
    points: Number,
    type: String, // "SignUp_Points || KYC_Points || BuyIndexxToken_Points || OneTransactionCompleted_Points || BugReported_Points || InvitedUserPoints "
    date: Date,
  },
  taskCenterSchemaOptions
);

taskCenterSchema.add({
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
  lottoPoints: Number,
  isKYCPass: Boolean,
  KYCPoints: Number,
  tradeToEarnPercentage: { type: Number, default: 0 },
  isBuyIndexxTokens: Boolean,
  buyIndexxTokensPoints: Number,
  isSignUp: Boolean,
  signUpPoints: Number,
  inivitedUsersEmail: [{ type: String, default: [] }],
  pointsHistory: [{ type: pointHistoryObj, default: [] }],
});

export default taskCenterSchema;

/**
 * userId: string;
    email: string;
    totalPoints: number;
    redeemPoints: number;
    inivitedUsersCount: number;
    isInivitedThreeUsers: boolean;
    isReportedBug: boolean;
    remainingPoints: number;
    isTransactionCompletedInExchange: boolean;
    transactionPoints: number;
    lottoPoints: number;
    isParticipatedInLotto: boolean;*/
