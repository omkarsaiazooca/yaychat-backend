// src/models/Message.ts
import { Schema } from 'mongoose';
import { randomUUID } from "crypto";
import { IDocumentModel } from '../data/base';
import { ChatGroup, ChatMessage } from '../data/ChatMessage';

export interface ChatMessageModel extends IDocumentModel<ChatMessage>, ChatMessage { }
const ChatMessageSchema = new Schema({
    email: String,
    messageId: { type: String, default: () => randomUUID(), immutable: true, },
    clientId: { type: String, index: true },
    receiverEmail: String,
    firstName: String,
    lastName: String,
    message: String,
    fileUrl: String,
    fileType: {
        type: String,
        enum: ['image', 'document', 'video', 'pdf', 'word', 'file'],
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    groupId: String,
    userId: String,
    notificationId: String,
    isDeleted: {
        type: Boolean,
        default: false,
    },
    isUpdated: {
        type: Boolean,
        default: false,
    },
    reactions: {
        type: [{
            name: String,
            users: [String],
            count: Number,
        }],
    },
    replyTo: {
        messageId: { type: String },
        email: String,
        firstName: String,
        lastName: String,
        message: String,
        fileUrl: String,
        fileType: {
            type: String,
            enum: ['image', 'document', 'video', 'pdf', 'word', 'file'],
        },
        timestamp: Date,
    },
    replyCount: { type: Number, default: 0 },
    replies: [{
        messageId: { type: String },
        email: String,
        firstName: String,
        lastName: String,
        message: String,
        fileUrl: String,
        fileType: {
            type: String,
            enum: ['image', 'document', 'video', 'pdf', 'word', 'file'],
        },
        timestamp: Date,
    }],

});

ChatMessageSchema.index({ groupId: 1, timestamp: 1 });
ChatMessageSchema.index({ groupId: 1, email: 1, timestamp: 1 });
ChatMessageSchema.index({ groupId: 1, _id: -1 });
ChatMessageSchema.index({ receiverEmail: 1, email: 1, _id: -1 });
ChatMessageSchema.index({ email: 1, clientId: 1 }, {
    unique: true,
    partialFilterExpression: { clientId: { $exists: true, $type: "string" } },
    name: "uniq_sender_clientId_partial",
});
ChatMessageSchema.index({ receiverEmail: 1, email: 1, groupId: 1, isRead: 1, timestamp: -1 });
ChatMessageSchema.index({ email: 1, receiverEmail: 1, groupId: 1, timestamp: -1 });
ChatMessageSchema.add({
    messageId: { type: String, index: true }
});

ChatMessageSchema.index(
    { messageId: 1 },
    {
        unique: true,
        partialFilterExpression: { messageId: { $exists: true } },
        name: "uniq_messageId_partial",
    }
);
export default ChatMessageSchema;
