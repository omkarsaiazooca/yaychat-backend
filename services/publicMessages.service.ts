import { publicMessages } from "../data/publicMessages";
import publicMessagesSchema, { PublicMessagesModel } from "../models/publicMessages";
import { ServiceBase } from "./base";

export class PublicMessagesService extends ServiceBase<publicMessages, PublicMessagesModel> {
    constructor() {
        super(publicMessagesSchema, "PublicMessages");
    }

}