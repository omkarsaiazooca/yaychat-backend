import { Router } from "express";
import { DaoController } from "../controllers/daoAPI";

const daoController = new DaoController();
const router: Router = Router();

router.post("/getDashboard", daoController.getUserRoleDashboard);
router.post("/createProposal", daoController.createProposal);
router.post("/voteProposal", daoController.voteOnProposal);
router.get("/listProposal", daoController.listProposals);
router.get("/getProposalDetail/:id", daoController.getProposalDetail);
router.post("/claimTask/:taskId", daoController.claimTask);
router.post("/submitTaskProof", daoController.submitTaskProof);
router.get("/myReputation", daoController.getMyReputation);
router.get("/myTasks", daoController.getMyTasks);
router.post("/roleManagement", daoController.manageRoles);
router.get("/notifications", daoController.getNotifications);

export const daoRoute = router;