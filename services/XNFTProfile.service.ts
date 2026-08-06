import { XNFTProfile } from "../data/xnftUserProfile";
import XNFTProfileSchema, { XNFTProfileModel } from "../models/xnftUserProfile";
import { ServiceBase } from "./base";

export class XNFTProfileService extends ServiceBase<
  XNFTProfile,
  XNFTProfileModel
> {
  constructor() {
    super(XNFTProfileSchema, "XNFTProfile");
  }
}
