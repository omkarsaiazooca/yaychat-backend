import { ServiceBase } from "./base";
import AppSettingsSchema, { AppSettingsModel } from "../models/appSettings";
import { AppSettings } from "../data/appSettings";

export class AppSettingsService extends ServiceBase<AppSettings, AppSettingsModel> {
    constructor() {
        super(AppSettingsSchema, "AppSettings");
    }

    async getSettings() {
        try {
            const settings = await this.find({});
            if (settings) {
                return { status: 200, data: settings };
            } else {
                return { status: 500, data: {} as AppSettings };
            }
        } catch (err) {
            return { status: 500, data: {} as AppSettings };
        }
    }


    async btcyAppSettings() {
        try {
            const settings = await this.findOne({ key: "BTCYAppDetails" });
            console.log("btcyAppSettings", settings);
            if (settings) {
                return { status: 200, data: settings };
            } else {
                return { status: 500, data: {} as AppSettings };
            }
        } catch (err) {
            return { status: 500, data: {} as AppSettings };
        }
    }

    async updateSettings(req: any, res: any) {
        try {
            const settings = await this.updatePart({
                key: req.body.key,
            }, {
                $set: {
                    value: req.body.value,
                    description: req.body.description,
                    lastUpdatedOn: new Date()
                }
            });
            if (settings) {
                return { status: 200, data: settings };
            } else {
                return { status: 500, data: {} as AppSettings };
            }
        } catch (err) {
            return { status: 500, data: {} as AppSettings };
        }
    }

    async getSettingsBykey(key: string) {
        try {
            const settings = await this.findOne({ key: key });
            if (settings) {
                return { status: 200, data: settings };
            } else {
                return { status: 500, data: {} as AppSettings };
            }
        } catch (err) {
            return { status: 500, data: {} as AppSettings };
        }
    }
}