import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { AppSettings } from '../data/appSettings';

export interface AppSettingsModel extends IDocumentModel<AppSettings>, AppSettings {
}

var appSettingsSchema: Schema = new Schema();

appSettingsSchema.add({
    key: String,
    value: Number,
    description: String,
    lastUpdatedOn: Date
})

export default appSettingsSchema;