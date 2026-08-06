import { ServiceBase } from "./base";
import KybDirectorSchema, { KybDirectorModel } from "../models/kybDirector";
import { KybDirector } from "../data/kybDirector";

export class KybDirectorService extends ServiceBase<KybDirector, KybDirectorModel> {
  constructor() {
    super(KybDirectorSchema, "KybDirector");
  }
}






