import { Category } from "../data/categories";
import { Product } from "../data/products";
import categorySchema, { CategoriesModel } from "../models/categories";
import { productSchema, ProductsModel } from "../models/products";
import { ServiceBase } from "./shopbase";

export class ShopProductsService extends ServiceBase<Product, ProductsModel> {
    constructor() {
        super(productSchema, "Products");
    }

    
}