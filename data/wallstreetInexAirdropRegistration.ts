import { IDocumentModel, IModel } from "./base";

/**
 * WallStreet INEX Airdrop registration (Bitcoin Yay landing page form).
 *
 * Note: We use `_id = emailLower` to guarantee one registration per email
 * without relying on autoIndex/unique index creation in production.
 */
export interface WallstreetInexAirdropRegistration
  extends IModel,
    IDocumentModel<WallstreetInexAirdropRegistration> {
  // Stored as `_id = emailLower` in Mongo for uniqueness.
  // Marked optional here to avoid conflicts with Mongoose's Document typing.
  _id?: any;
  email: string;
  emailLower: string;
  name: string;
  userId: any;
  createdAt: Date;
}

