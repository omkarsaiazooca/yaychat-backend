import { Repository } from "../db/base";
import { DaoProposal } from "../data/dao";
import daoSchema, { DaoModel } from "../models/dao";
import { DaoUserService } from "./daoUser.service";

export class DaoService extends Repository<DaoProposal, DaoModel> {
  private userService = new DaoUserService();
  constructor() {
    super(daoSchema, "DaoProposal");
  }

  async findByRole(email: string) {
    try {
      return await this.find({ createdBy: email });
    } catch (err) {
      console.error("findByRole error:", err);
      throw err;
    }
  }

  async vote(proposalId: string, vote: string, userEmail: string) {
    const update: any = {
      $push: {
        votes: { user: userEmail, vote, date: new Date() }
      }
    };

    if (vote === "up" || vote === "yes") {
      update.$inc = { upvotes: 1 };
      update.$addToSet = { upvotedBy: userEmail };
    } else {
      update.$inc = { downvotes: 1 };
      update.$addToSet = { downvotedBy: userEmail };
    }

    await this.updatePart({ proposalId }, update);

    await this.userService.recordVote(userEmail, proposalId, vote);
    await this.userService.addReputation(userEmail, 10);
  }


  async getUserDashboard(email: string) {
    try {
      return await this.userService.getDashboardData(email);
    } catch (err) {
      console.error("getUserDashboard error:", err);
      throw err;
    }
  }


  async getReputation(email: string) {
    try {
      // Replace with actual query from a user DAO collection if available
      return await this.findOneSelect({ createdBy: email }, { reputation: 1, role: 1 });
    } catch (err) {
      console.error("getReputation error:", err);
      throw err;
    }
  }

  async getTasksForUser(email: string) {
    try {
      // Replace with task DAO lookup if a task schema is available
      return await this.findSelect({ assignedTo: email }, { title: 1, status: 1 });
    } catch (err) {
      console.error("getTasksForUser error:", err);
      throw err;
    }
  }



  async getNotifications(email: string) {
    try {
      return await this.findSelect({ email }, { notifications: 1 });
    } catch (err) {
      console.error("getNotifications error:", err);
      throw err;
    }
  }

  async claimTask(email: string, taskId: string, taskName: string) {
    await this.updatePart({ taskId }, { assignedTo: email, status: "claimed" });
    await this.userService.assignTask(email, taskId, taskName);
  }

  async submitTaskProof(taskId: string, proof: string) {
    return this.updatePart(
      { taskId },
      { proofSubmitted: proof, status: "pending_review" }
    );
  }

  async manageRoles(email: string, newRole: string) {
    return await this.userService.updateRole(email, newRole);
  }

}
