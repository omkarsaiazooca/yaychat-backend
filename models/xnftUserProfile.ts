import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { XNFTProfile } from "../data/xnftUserProfile";

export interface XNFTProfileModel
  extends IDocumentModel<XNFTProfile>,
    XNFTProfile {}

const XNFTProfileSchema = new Schema({
  address: String,
  profileImage: String,
  updateOn: Date,
});

export default XNFTProfileSchema;
