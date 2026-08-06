import { InvestmentRecord } from "../data/InvestmentRecord";
import InvestmentRecordSchema, {
    InvestmentRecordModel,
} from "../models/investment";
import { ServiceBase } from "./base";

export class InvestmentService extends ServiceBase<InvestmentRecord, InvestmentRecordModel> {
  constructor() {
    super(InvestmentRecordSchema, "Investments");
  }
}
