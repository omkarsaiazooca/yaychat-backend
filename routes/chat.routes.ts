    // src/routes/chatRoutes.ts
import express, { Router } from 'express';
import { ChatController } from '../controllers/chatAPI';
import { validateAuthHeader } from '../helpers/middleware';


const chatRouter: Router = Router();
const chatController = new ChatController();

// Message routes
chatRouter.get("/upload-url", (req, res) => chatController.getPresignedUrl(req, res));
chatRouter.post('/messages', chatController.sendMessage);
chatRouter.post('/messages/referrals', chatController.sendReferralMessages);
chatRouter.post('/sendGroupmessage', chatController.sendGroupMessage);
chatRouter.get('/messages/count', chatController.getMessageCount);
chatRouter.get('/messages/unread/count', chatController.getMessageUnreadCount);
chatRouter.get('/messages/:email/paged', chatController.getMessagesPaged);
chatRouter.get('/messages/:email', chatController.getMessages);
chatRouter.get('/lastmessages/:email', chatController.getLatestMessages);
chatRouter.post('/messages/read', chatController.markAsRead);
chatRouter.patch('/messages/update', validateAuthHeader, chatController.updateMessage);
chatRouter.delete('/messages/delete', validateAuthHeader, chatController.deleteMessage);
chatRouter.post('/messages/reactions/add', validateAuthHeader, chatController.addReaction);
chatRouter.post('/messages/reactions/remove', validateAuthHeader, chatController.removeReaction);
chatRouter.get('/counts/unread', chatController.getUnreadSummary);
chatRouter.post('/messages/:messageId/reply', validateAuthHeader, chatController.replyToMessage);

// Group routes
chatRouter.post('/groups/referral', chatController.createReferralGroup);
chatRouter.post('/groups/custom', chatController.createCustomGroup);
chatRouter.get('/groups', chatController.getUserGroups);
chatRouter.post('/groups/join/:referralCode', chatController.joinReferralGroup);
chatRouter.get('/groups/:groupId/unread/count', chatController.getGroupUnreadCount);
chatRouter.post('/groups/:groupId/read', chatController.markGroupRead);
chatRouter.post('/groups/:groupId/join', chatController.joinGroup);
chatRouter.post('/groups/:groupId/leave', chatController.leaveGroup);
chatRouter.get('/groups/:groupId/messages', chatController.getGroupMessages);
chatRouter.get('/groups/:groupId/messages/paged', chatController.getGroupMessagesPaged);
chatRouter.get('/groups/:groupId/messages/count', chatController.getGroupMessageCount);
chatRouter.patch('/groups/:groupId', validateAuthHeader, chatController.updateGroup);
chatRouter.delete('/groups/:groupId', validateAuthHeader, chatController.deleteGroup);
chatRouter.post('/groups/:groupId/members', validateAuthHeader, chatController.addGroupMembers);
chatRouter.delete('/groups/:groupId/members', validateAuthHeader, chatController.removeGroupMembers);
chatRouter.post('/groups/:groupId/members/batch', validateAuthHeader, chatController.syncGroupMembers);
chatRouter.post('/groups/:groupId/block', validateAuthHeader, chatController.setGroupMessagingBlock);
chatRouter.post('/groups/:groupId/members/block', validateAuthHeader, chatController.blockGroupMember);
chatRouter.post('/groups/:groupId/members/unblock', validateAuthHeader, chatController.unblockGroupMember);

// User block/report routes (direct chat)
chatRouter.post('/users/block', validateAuthHeader, chatController.blockUser);
chatRouter.post('/users/unblock', validateAuthHeader, chatController.unblockUser);
chatRouter.get('/users/blocked', validateAuthHeader, chatController.getBlockedUsers);
chatRouter.post('/users/report', validateAuthHeader, chatController.reportUser);
chatRouter.get('/users/reports', validateAuthHeader, chatController.getReportedUsers);
chatRouter.post('/users/block-direct', validateAuthHeader, chatController.blockUserDirect);
chatRouter.post('/users/unblock-direct', validateAuthHeader, chatController.unblockUserDirect);
chatRouter.get('/users/blocked-direct', validateAuthHeader, chatController.getBlockedUsersDirect);

// Admin-only group management routes
chatRouter.get('/admin/groups/bonus-rewards', validateAuthHeader, chatController.getAdminGroupBonusRewards);
chatRouter.post('/admin/groups', validateAuthHeader, chatController.createAdminOnlyGroup);
chatRouter.get('/admin/groups', validateAuthHeader, chatController.getAdminOnlyGroups);
chatRouter.put('/admin/groups/:groupId', validateAuthHeader, chatController.updateAdminOnlyGroup);

// Chat muting routes
chatRouter.post('/mute', validateAuthHeader, chatController.muteChat);

export const chatRoute = chatRouter;
