import { IDocumentModel } from "../data/base";
import { Category, Type, Image } from "../data/categories";
import { Schema } from "mongoose";

export interface CategoriesModel extends IDocumentModel<Category>, Category {}

// Schema for Image
const imageSchema = new Schema<Image>({
  id: { type: String, default: null },
  original: { type: String, default: null },
  thumbnail: { type: String, default: null },
});

// Schema for TypeSettings
const typeSettingsSchema = new Schema({
  isHome: { type: Boolean },
  layoutType: { type: String },
  productCard: { type: String },
});

// Schema for Type
const typeSchema = new Schema<Type>({
  name: { type: String },
  language: { type: String },
  translated_languages: [{ type: String }],
  settings: { type: typeSettingsSchema },
  slug: { type: String },
  icon: { type: String },
  promotional_sliders: { type: [imageSchema] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export var categorySchema: Schema = new Schema();
// Schema for Category
categorySchema.add({
  name: { type: String },
  slug: { type: String },
  icon: { type: String, default: null },
  image: { type: [imageSchema], default: [] },
  details: { type: String, default: null },
  language: { type: String },
  translated_languages: [{ type: String }],
  parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  type_id: { type: Number },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
  parent_id: { type: Number, default: null },
  type: { type: typeSchema, default: null },
  children: [{ type: [], default: [] }],
  products_count: { type: Number, default: 0 },
});

export default categorySchema;
