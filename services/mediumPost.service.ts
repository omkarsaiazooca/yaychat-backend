import { MediumPost } from "../data/mediumPostData";
import MediumPostSchema, { MediumPostModel } from "../models/mediumPost";
import { ServiceBase } from "./base";

export class MediumPostService extends ServiceBase<
  MediumPost,
  MediumPostModel
> {
  constructor() {
    super(MediumPostSchema, "MediumPost");
  }
}
