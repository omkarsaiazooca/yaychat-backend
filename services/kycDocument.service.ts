import { ServiceBase } from "./base";
import KycDocumentSchema, { KycDocumentModel } from "../models/kycDocument";
import { KycDocument } from "../data/kycDocument";

export class KycDocumentService extends ServiceBase<KycDocument, KycDocumentModel> {
  constructor() {
    super(KycDocumentSchema, "KycDocument");
  }
}

