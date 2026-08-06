import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { publicMessages } from "../data/publicMessages";

export interface PublicMessagesModel
  extends IDocumentModel<publicMessages>,
    publicMessages {}
const publicMessagesSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var publicMessagesSchema: Schema = new Schema({}, publicMessagesSchemaOptions);

publicMessagesSchema.add({
  publicMessage: String,
  createdData: Date,
  createdUsername: String,
  createdUserEmail: String,
  isActive: Boolean,
  createdFrom: String,
});

export default publicMessagesSchema;
