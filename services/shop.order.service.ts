import { Order } from "../data/shoporder";
import OrderSchema, { OrderModel } from "../models/shoporder";
import { ServiceBase } from "./shopbase";

export class ShopOrdersService extends ServiceBase<Order, OrderModel> {
    constructor() {
        super(OrderSchema, "ShopOrders");
    }

    
}