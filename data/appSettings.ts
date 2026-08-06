import { IDocumentModel, IModel } from "./base";

export interface AppSettings extends IModel, IDocumentModel<AppSettings> {
    key: string;
    value: number;
    description: string;
    lastUpdatedOn: Date;
}