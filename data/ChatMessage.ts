import { Types } from "mongoose";

// src/types/ChatTypes.ts
export interface ChatMessage {
    _id?: any;
    email: string;
    messageId?: string;
    clientId?: string;
    receiverEmail?: string;
    userId: string;
    firstName: string;
    lastName: string;
    message?: string;
    fileUrl?: string;
    fileType?: 'image' | 'document' | 'video' | 'pdf' | 'word' | 'file' ;
    timestamp?: Date;
    groupId?: string; // For group chats
    isRead?: boolean;
    notificationId?: string;
    replyCount?: number;
    isDeleted?: boolean;
    isUpdated?: boolean;
    reactions?: {
        name: string;
        users: string[];
        count: number;
    }[];
    replyTo?: {
        messageId: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        message?: string;
        fileUrl?: string;
        fileType?: 'image' | 'document' | 'video' | 'pdf' | 'word' | 'file';
        timestamp?: Date;
    };
    replies?: {
        messageId: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        message?: string;
        fileUrl?: string;
        fileType?: 'image' | 'document' | 'video' | 'pdf' | 'word' | 'file';
        timestamp?: Date;
    }[];
}

export interface ChatGroup {
    name: string;
    createdBy: string;
    members: string[];
    createdAt?: Date; // Made optional with ?
    isReferralGroup: boolean;
    referralCode?: string;
    lastMessage?: string;
    lastMessageAt?: Date;
    groupId: string;
    isGlobal: boolean;
    isAdminOnly?: boolean;
    isMessagingBlocked?: boolean;
    messagingBlockedBy?: string;
    messagingBlockedAt?: Date;
    messagingBlockedReason?: string;
    blockedMembers?: string[];
}
