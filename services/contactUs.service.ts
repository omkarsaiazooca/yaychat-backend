import { ServiceBase } from "./base";
import contactUsSchema, { ContactUsModel } from "../models/contactUs";
import { ContactUs } from "../data/contactUs";
export class ContactUsService extends ServiceBase<ContactUs, ContactUsModel> {
  constructor() {
    super(contactUsSchema, "ContactUs");
  }
}
