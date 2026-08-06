import { IModel, IDocumentModel } from "./base";

export interface GroupActivity extends IModel, IDocumentModel<GroupActivity> {
    email: string;      // user who opened the chat (lowercased)
    groupId: string;    // which group they opened
    groupName?: string; // human-readable group name
    timestamp: Date;    // when they opened it
}
