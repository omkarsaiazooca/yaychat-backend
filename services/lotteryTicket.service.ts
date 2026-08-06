import { Ticket } from "../data/lottery";
import { TicketLotterySchema, TicketModel } from "../models/lottery";
import { ServiceBase } from "./base";

export class LotteryTicketService extends ServiceBase<Ticket, TicketModel> {
  constructor() {
    super(TicketLotterySchema, "TicketLottery");
  }
}