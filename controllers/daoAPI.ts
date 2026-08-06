import { DaoOperations } from "../platform/dao.operations";


export class DaoController {
  async getUserRoleDashboard(req: any, res: any) {
    try {
      const daoOperations = new DaoOperations(req, res);

      const result = await daoOperations.getUserRoleDashboard(req.body.email);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send({ message: "Error: " + error });
    }
  }

  async createProposal(req: any, res: any) {
    try {
      const daoOperations = new DaoOperations(req, res);
      const result = await daoOperations.createProposal(req.body);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send({ message: "Error: " + error });
    }
  }

  async voteOnProposal(req: any, res: any) {
    try {
      const daoOperations = new DaoOperations(req, res);
      const result = await daoOperations.voteOnProposal(req.body);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send({ message: "Error: " + error });
    }
  }

  async listProposals(req: any, res: any) {
    try {
      const daoOperations = new DaoOperations(req, res);
      const result = await daoOperations.listProposals();
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send({ message: "Error: " + error });
    }
  }

  async getProposalDetail(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.getProposalDetail(req.params.id);
    res.status(200).json(data);
  }

  async claimTask(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.claimTask(req.body.email, req.params.taskId, req.body.taskName);
    res.status(200).json(data);
  }

  async submitTaskProof(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.submitTaskProof(req.body);
    res.status(200).json(data);
  }

  async getMyReputation(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.getMyReputation(req.query.email as string);
    res.status(200).json(data);
  }

  async getMyTasks(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.getMyTasks(req.query.email as string);
    res.status(200).json(data);
  }

  async manageRoles(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.manageRoles(req.body);
    res.status(200).json(data);
  }

  async getNotifications(req: any, res: any) {
    const daoOperations = new DaoOperations(req, res);
    const data = await daoOperations.getNotifications(req.query.email as string);
    res.status(200).json(data);
  }
}
