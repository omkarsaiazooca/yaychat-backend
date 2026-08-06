import { Document } from 'mongoose';

export interface IModel {
}

export interface IDocumentModel<T extends IModel> extends Document, IModel {
}