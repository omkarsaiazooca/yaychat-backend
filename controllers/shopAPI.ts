import { ShopCategoriesOperations } from "../platform/shop.categories.operations";
import { ShopProductsOperations } from "../platform/shop.products.operations";

export class ShopController {
  constructor() {}

  async createCategory(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.createCategory(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getCategories(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.getCategories(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getProducts(req: any, res: any) {
    try {
      const operations = new ShopProductsOperations(req, res);
      let result: any = await operations.getProducts(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getCategoryById(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.getCategoryById(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async createOrder(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.createOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateOrder(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.updateOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  
  async updateOrderUsingWallet(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.updateOrderUsingWallet(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getOrders(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.getOrders(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserOrders(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any;

      // Extract the identifier from the URL
      const identifier = req.params.email; // Assuming the route is set up to capture the identifier
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trackingNumberRegex = /^[a-f0-9\-]{36}$/; // Assuming tracking number is a UUID

      if (emailRegex.test(identifier)) {
        // If the identifier matches an email pattern, use getUserOrders
        req.query.email = identifier;
        result = await operations.getUserOrders(req, res);
      } else if (trackingNumberRegex.test(identifier)) {
        // If the identifier matches a tracking number pattern, use getUserByTrackingNumber
        req.query.tracking_number = identifier;
        result = await operations.getUserByTrackingNumber(req, res);
      } else {
        res.statusCode = 400;
        res.send({
          status: 400,
          data: { message: "Invalid email or tracking number" },
        });
        return;
      }

      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async getUserByTrackingNumber(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.getUserByTrackingNumber(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async updateOrderByAdmin(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.updateOrderByAdmin(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }

  async refundOrder(req: any, res: any) {
    try {
      const operations = new ShopCategoriesOperations(req, res);
      let result: any = await operations.refundOrder(req, res);
      res.statusCode = result.status;
      res.send(result);
      return;
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
      return;
    }
  }
}
