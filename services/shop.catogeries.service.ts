import { Category } from "../data/categories";
import categorySchema, { CategoriesModel } from "../models/categories";
import { ServiceBase } from "./shopbase";

export class ShopCategoriesService extends ServiceBase<Category, CategoriesModel> {
    constructor() {
        super(categorySchema, "Categories");
    }

    
}