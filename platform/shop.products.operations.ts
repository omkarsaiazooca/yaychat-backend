import { Request, Response } from "express";
import { ShopProductsService } from "../services/shop.products.service";
import { BaseAPIOperations } from "./base.operations";
const shopProductsService: ShopProductsService =
  new ShopProductsService();
export class ShopProductsOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  // Get all categories
  async getProducts(req: any, res: any) {
    try {
      const categories = await shopProductsService.find({});
      return {
        status: 200,
        data: categories,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  // Get a category by ID
  async getProductById(req: any, res: any) {
    try {
      const categoryId = req.params.id;
      const category = await shopProductsService.findOne(categoryId);
      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "Category not found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }
}
