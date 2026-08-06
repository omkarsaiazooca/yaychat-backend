import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { PowerPack } from "../data/powerpack";

export interface PowerPackModel
  extends IDocumentModel<PowerPack>,
  PowerPack {}
const powerPackSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var powerPackSchema: Schema = new Schema({}, powerPackSchemaOptions);

powerPackSchema.add({
  amount: String,
  email: String,
  orderId: String,
  purchaseDate: Date,
  type: String,
  paymentMethodUsed: String,
  paymentStatus: String,
  notes: String
});

export default powerPackSchema;
