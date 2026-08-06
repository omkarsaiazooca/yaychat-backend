export interface MediumPost {
  postId: string;
  imageUrl: string; // URL of the post's image
  title: string; // Title of the post
  description: string; // Subtitle or description of the post
  url: string; // URL that the post should link to
  author: string; // Author of the post
  createdAt: Date; // Date when the post was created
  updatedAt?: Date; // Optional date when the post was last updated
  tags?: string[]; // Optional tags or categories for the post
  readTime: number; // Estimated reading time in minutes
  claps: number; // Number of claps the post has received
  commentsCount: number; // Number of comments on the post
  isPublished: boolean; // Indicates if the post is published or in draft
}
