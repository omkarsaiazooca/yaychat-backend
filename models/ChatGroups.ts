// src/models/Message.ts
import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { ChatGroup } from '../data/ChatMessage';

export interface ChatGroupModel extends IDocumentModel<ChatGroup>, ChatGroup { }

const ChatGroupSchema = new Schema({
    name: { type: String, required: true },
    groupId: { type: String, required: true },
    createdBy: { type: String, required: true },
    members: { type: [String], required: true, default: [] },
    isReferralGroup: { type: Boolean, default: false },
    isGlobal: { type: Boolean, default: false, index: true },
    isAdminOnly: { type: Boolean, default: false, index: true },
    referralCode: String,
    lastMessage: String,
    lastMessageAt: Date,
    isMessagingBlocked: { type: Boolean, default: false, index: true },
    messagingBlockedBy: String,
    messagingBlockedAt: Date,
    messagingBlockedReason: String,
    blockedMembers: {
        type: [String],
        default: [],
    }
}, {
    timestamps: true, // This will auto-add createdAt and updatedAt
    toJSON: {
        virtuals: true,
        versionKey: false,
        transform: (doc, ret) => {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});

export default ChatGroupSchema;
