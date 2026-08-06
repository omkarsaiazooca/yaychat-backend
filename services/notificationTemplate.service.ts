import { ServiceBase } from "./base";
import { notificationTemplateSchema, NotificationTemplateModel } from "../models/notifications";
import { NotificationTemplate } from "../data/notifications";

export class NotificationTemplateService extends ServiceBase<NotificationTemplate, NotificationTemplateModel> {
    constructor() {
        super(notificationTemplateSchema, "NotificationTemplate");
    }

    async getTemplateByType(type: string) {
        return await this.findOne({ type });
    }

    async getAllTemplates() {
        return await this.find({});
    }

    async getAdminTemplates(restrictedTypes: string[] = []) {
        return await this.find({ type: { $nin: restrictedTypes } });
    }
}
