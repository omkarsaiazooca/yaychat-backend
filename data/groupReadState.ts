import { IDocumentModel, IModel } from "./base";

export interface GroupReadState extends IModel, IDocumentModel<GroupReadState> {
    email: string;      // user email (lowercased)
    groupId: string;    // the group (uuid)
    lastReadAt: Date;   // monotonic cursor
    updatedAt: Date;
}