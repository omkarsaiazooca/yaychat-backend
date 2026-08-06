import { Router } from "express";
import { ShopController } from "../controllers/shopAPI";

const shopRouter: Router = Router();
const shopController: ShopController = new ShopController();

shopRouter.post("/categories", (req, res) => shopController.createCategory(req, res));
shopRouter.post("/categories", (req, res) => shopController.createCategory(req, res));
shopRouter.get("/products", (req, res) => shopController.getProducts(req, res));
shopRouter.get("/categories", (req, res) => shopController.getCategories(req, res));
shopRouter.post("/createOrder", (req, res) => shopController.createOrder(req, res));
shopRouter.post("/updateOrder", (req, res) => shopController.updateOrder(req, res));
shopRouter.post("/updateOrderUsingWallet", (req, res) => shopController.updateOrderUsingWallet(req, res));
shopRouter.get("/getOrders", (req, res) => shopController.getOrders(req, res));
shopRouter.get("/getUserOrders/:email", (req, res) => shopController.getUserOrders(req, res));
shopRouter.get("/getUserOrderByTrackingNumber/:id", (req, res) => shopController.getUserByTrackingNumber(req, res));
shopRouter.post("/admin/updateOrder", (req, res) => shopController.updateOrderByAdmin(req, res));
shopRouter.post("/refund", (req, res) => shopController.refundOrder(req, res));


export const shopRoute = shopRouter;
