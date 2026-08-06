import { ServiceBase } from "./base";
import ChatUserReportSchema, { ChatUserReportModel } from "../models/chatUserReport";
import { ChatUserReport } from "../data/chatUserReport";

export class ChatUserReportService extends ServiceBase<
  ChatUserReport,
  ChatUserReportModel
> {
  constructor() {
    super(ChatUserReportSchema, "ChatUserReport");
  }
}
