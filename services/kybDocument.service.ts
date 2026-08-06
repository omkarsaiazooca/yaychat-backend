import { ServiceBase } from "./base";
import kybDocumentSchema, { KybDocumentModel } from "../models/kybDocument";
import { KybDocument } from "../data/kybDocument";

export class KybDocumentService extends ServiceBase<KybDocument, KybDocumentModel> {
  constructor() {
    super(kybDocumentSchema, "KybDocument");
  }
}






