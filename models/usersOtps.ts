import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { Currency, CurrencyType, PaymentTypes, TransactionType, WalletType } from '../data/common';
import { Order, OrderStatus } from '../data/order';
import { Transaction } from '../data/transaction';
import { userOtps } from '../data/userOtp';
import { basicSchema, cryptoAccount } from './common';

export interface UserOtpsModel extends IDocumentModel<userOtps>, userOtps {
}
const userOtpsSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var userOtpsSchema: Schema = new Schema({}, userOtpsSchemaOptions);

userOtpsSchema.add({
    emailVerified: Boolean,
    emailVerifiedOn: Date,
    emailCode: String,
    emailCodeExpiry: Date,
    email: String,
    phone: String,
    phoneVerified: Boolean,
    phoneVerifiedOn: Date,
    phoneCode: String,
    phoneCodeExpiry: Date,
    forgotPasswordCode: String,
    forgotPasswordCodeExpiry: Date,
    authMethod: { type: String, enum: ['email', 'phone'], default: 'email' }
})

export default userOtpsSchema;