import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { MediumPost } from "../data/mediumPostData";

// Define the interface for MediumPostModel, extending the base document model
export interface MediumPostModel
  extends IDocumentModel<MediumPost>,
    MediumPost {}

// Define the MediumPost schema
export var MediumPostSchema: Schema = new Schema();

// Add fields to the MediumPost schema
MediumPostSchema.add({
  postId: { type: String },
  title: { type: String }, // Title of the post
  author: { type: String }, // Author of the post
  description: { type: String }, // Subtitle or description of the post
  url: { type: String }, // Url of the post
  imageUrl: { type: String }, // Optional featured image for the post
  createdAt: { type: Date, default: Date.now }, // Creation date
  updatedAt: { type: Date }, // Last updated date
  tags: { type: [String] }, // Optional tags or categories
  readTime: { type: Number }, // Estimated reading time
  claps: { type: Number, default: 0 }, // Number of claps
  commentsCount: { type: Number, default: 0 }, // Number of comments
  isPublished: { type: Boolean, default: false }, // Publish status
});

// Export the schema as the default export
export default MediumPostSchema;
