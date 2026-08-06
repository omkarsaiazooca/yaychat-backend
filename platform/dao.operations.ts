import { DaoService } from "../services/dao.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";

const daoService = new DaoService();

export class DaoOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async getUserRoleDashboard(email: string) {
    try {
      const dashboard = await daoService.getUserDashboard(email);
      return { status: 200, data: dashboard };
    } catch (error) {
      return { status: 500, data: "Failed to fetch dashboard" };
    }
  }

  async createProposal(data: any) {
    try {
      const proposal = await daoService.create(data);
      return { status: 201, data: proposal };
    } catch (error) {
      return { status: 500, data: "Error creating proposal" };
    }
  }

  async voteOnProposal(data: any) {
    try {
      const { proposalId, vote, user } = data;
      const result = await daoService.vote(proposalId, vote, user);
      return { status: 200, data: result };
    } catch (error) {
      return { status: 500, data: "Voting failed" };
    }
  }

  async listProposals() {
    try {
      const proposals = await daoService.find({});
      return { status: 200, data: proposals };
    } catch (error) {
      return { status: 500, data: "Failed to list proposals" };
    }
  }

  async getProposalDetail(id: string) {
    try {
      const detail = await daoService.findOne({ proposalId: id });
      return { status: 200, data: detail };
    } catch (error) {
      return { status: 500, data: "Proposal not found" };
    }
  }

  async claimTask(email: string, taskId: string, taskName: string) {
    try {
      const result = await daoService.claimTask(email, taskId, taskName);
      return { status: 200, data: result };
    } catch (error) {
      return { status: 500, data: "Failed to claim task" };
    }
  }

  async submitTaskProof(body: any) {
    try {
      const result = await daoService.submitTaskProof(body.taskId, body.proof);
      return { status: 200, data: result };
    } catch (error) {
      return { status: 500, data: "Task submission failed" };
    }
  }

  async getMyReputation(email: string) {
    try {
      const rep = await daoService.getReputation(email);
      return { status: 200, data: rep };
    } catch (error) {
      return { status: 500, data: "Failed to get reputation" };
    }
  }

  async getMyTasks(email: string) {
    try {
      const tasks = await daoService.getTasksForUser(email);
      return { status: 200, data: tasks };
    } catch (error) {
      return { status: 500, data: "Failed to get tasks" };
    }
  }

  async manageRoles(body: any) {
    try {
      const result = await daoService.manageRoles(body.userId, body.newRole);
      return { status: 200, data: result };
    } catch (error) {
      return { status: 500, data: "Role management failed" };
    }
  }

  async getNotifications(email: string) {
    try {
      const result = await daoService.getNotifications(email);
      return { status: 200, data: result };
    } catch (error) {
      return { status: 500, data: "Failed to get notifications" };
    }
  }
}
