import { IDocumentModel } from "../data/base";
import { Category, Type, Image } from "../data/categories";
import { Schema, model } from "mongoose";
import { Product } from "../data/products";

export interface ProductsModel extends IDocumentModel<Product>, Product {}

// Define the schema for Image
const imageSchema = new Schema<Image>({
  id: { type: String, default: null },
  original: { type: String, default: null },
  thumbnail: { type: String, default: null },
});

// Define the schema for TypeSettings
const typeSettingsSchema = new Schema({
  isHome: { type: Boolean },
  layoutType: { type: String },
  productCard: { type: String },
});

// Define the schema for Type
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

// Define the schema for Category
const categorySchema = new Schema<Category>({
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
  children: [{ type: Schema.Types.ObjectId, ref: "Category", default: [] }],
  products_count: { type: Number, default: 0 },
});

// Define the schema for Product
export const productSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String },
  type_id: { type: Number },
  price: { type: Number },
  shop_id: { type: Number },
  sale_price: { type: Number },
  language: { type: String },
  min_price: { type: Number },
  max_price: { type: Number },
  sku: { type: String },
  quantity: { type: Number },
  in_stock: { type: Number },
  is_taxable: { type: Number },
  shipping_class_id: { type: Schema.Types.Mixed, default: null },
  status: { type: String },
  product_type: { type: String },
  unit: { type: String },
  height: { type: Schema.Types.Mixed, default: null },
  width: { type: Schema.Types.Mixed, default: null },
  length: { type: Schema.Types.Mixed, default: null },
  image: { type: imageSchema },
  video: { type: Schema.Types.Mixed, default: null },
  gallery: [imageSchema],
  deleted_at: { type: Schema.Types.Mixed, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  author_id: { type: Schema.Types.Mixed, default: null },
  manufacturer_id: { type: Schema.Types.Mixed, default: null },
  is_digital: { type: Number },
  is_external: { type: Number },
  external_product_url: { type: Schema.Types.Mixed, default: null },
  external_product_button_text: { type: Schema.Types.Mixed, default: null },
  ratings: { type: Number },
  total_reviews: { type: Number },
  rating_count: [{
    rating: { type: Number },
    total: { type: Number },
    positive_feedbacks_count: { type: Number },
    negative_feedbacks_count: { type: Number },
    my_feedback: { type: Schema.Types.Mixed, default: null },
    abusive_reports_count: { type: Number },
  }],
  my_review: { type: Schema.Types.Mixed, default: null },
  in_wishlist: { type: Boolean },
  blocked_dates: [{ type: Schema.Types.Mixed }],
  translated_languages: [{ type: String }],
  categories: [{ type: categorySchema }],
  shop: {
    id: { type: Number },
    owner_id: { type: Number },
    name: { type: String },
    slug: { type: String },
    description: { type: String },
    cover_image: imageSchema,
    logo: imageSchema,
    is_active: { type: Number },
    address: {
      zip: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      street_address: { type: String },
    },
    settings: {
      contact: { type: String },
      socials: [{
        url: { type: String },
        icon: { type: String },
      }],
      website: { type: String },
      location: {
        lat: { type: Number },
        lng: { type: Number },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        formattedAddress: { type: String },
      },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  type: typeSchema,
  variations: [{ type: Schema.Types.Mixed }],
  metas: [{ type: Schema.Types.Mixed }],
  manufacturer: { type: Schema.Types.Mixed, default: null },
  variation_options: [{ type: Schema.Types.Mixed }],
  tags: [{ type: Schema.Types.Mixed }],
  author: { type: Schema.Types.Mixed, default: null },
});

