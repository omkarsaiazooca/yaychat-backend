import { Router } from "express";
import { YaysCommunitiesController } from "../controllers/yaysCommunitiesAPI";
import { validateAuthHeader } from "../helpers/middleware";

const yaysCommunitiesRouter: Router = Router();
const controller = new YaysCommunitiesController();

// Public: categories and report reasons. The client reads this before sign-in
// so the Communities tab can render its filters without a session.
yaysCommunitiesRouter.get("/config", controller.getConfig);

// Everything else is authenticated: discovery still needs to know whether
// *this* person has joined, is banned, or has a request pending.
yaysCommunitiesRouter.use(validateAuthHeader);

// Discovery
yaysCommunitiesRouter.get("/", controller.discover);
yaysCommunitiesRouter.get("/mine", controller.mine);

// Invites are resolved before a community id is known, so they sit above
// `/:communityId` — Express matches in declaration order.
yaysCommunitiesRouter.get("/invites/preview", controller.previewInvite);
yaysCommunitiesRouter.post("/invites/accept", controller.acceptInvite);

// Scheduled announcements: publish everything now due, across all communities.
yaysCommunitiesRouter.post("/announcements/sweep", controller.sweepScheduled);

// Lifecycle
yaysCommunitiesRouter.post("/", controller.create);
yaysCommunitiesRouter.get("/:communityId", controller.detail);
yaysCommunitiesRouter.patch("/:communityId", controller.update);
yaysCommunitiesRouter.post("/:communityId/verify", controller.setVerified);
yaysCommunitiesRouter.post("/:communityId/publishers", controller.setPublisher);

// Membership
yaysCommunitiesRouter.post("/:communityId/join", controller.join);
yaysCommunitiesRouter.post("/:communityId/leave", controller.leave);
yaysCommunitiesRouter.get("/:communityId/members", controller.listMembers);
yaysCommunitiesRouter.post("/:communityId/members/role", controller.setRole);
yaysCommunitiesRouter.post("/:communityId/members/remove", controller.removeMember);
yaysCommunitiesRouter.post("/:communityId/members/unban", controller.unban);
yaysCommunitiesRouter.post(
  "/:communityId/requests/:requestId",
  controller.decideJoinRequest
);

// Invite links for one community
yaysCommunitiesRouter.get("/:communityId/invites", controller.listInvites);
yaysCommunitiesRouter.post("/:communityId/invites", controller.mintInvite);
yaysCommunitiesRouter.delete("/:communityId/invites/:code", controller.revokeInvite);

// Feed
yaysCommunitiesRouter.post("/:communityId/posts", controller.post);
yaysCommunitiesRouter.post("/:communityId/posts/:postId/like", controller.likePost);
yaysCommunitiesRouter.delete("/:communityId/posts/:postId", controller.removePost);

// Polls and events
yaysCommunitiesRouter.post("/:communityId/polls", controller.createPoll);
yaysCommunitiesRouter.post("/:communityId/polls/:pollId/vote", controller.vote);
yaysCommunitiesRouter.post("/:communityId/events", controller.createEvent);
yaysCommunitiesRouter.post("/:communityId/events/:eventId/rsvp", controller.rsvp);

// Announcements: publish → (approve) → deliver → read analytics
yaysCommunitiesRouter.post("/:communityId/announcements", controller.publishAnnouncement);
yaysCommunitiesRouter.post(
  "/:communityId/announcements/:announcementId/approve",
  controller.approveAnnouncement
);
yaysCommunitiesRouter.post(
  "/:communityId/announcements/:announcementId/read",
  controller.readAnnouncement
);
yaysCommunitiesRouter.get(
  "/:communityId/announcements/:announcementId/stats",
  controller.announcementStats
);

// Reporting and moderation
yaysCommunitiesRouter.post("/:communityId/reports", controller.report);
yaysCommunitiesRouter.post(
  "/:communityId/reports/:reportId/resolve",
  controller.resolveReport
);

export { yaysCommunitiesRouter };
