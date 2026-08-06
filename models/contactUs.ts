import mongoose, { Document, Schema } from "mongoose";
import { ContactUs } from "../data/contactUs";

import { IDocumentModel } from "../data/base";
export interface ContactUsModel extends IDocumentModel<ContactUs>, ContactUs {}

const contactUsSchema: Schema = new Schema({
  email: { type: String, required: true },
  website: { type: String, required: true },
  date: { type: Date, default: Date.now },
  message: { type: String, required: true },
  name: { type: String },
  subject: { type: String },
});

export default contactUsSchema;
