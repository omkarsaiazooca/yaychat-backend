import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { BugStatus, UserBugs } from "../data/userBugs";

export interface UserBugsModel extends IDocumentModel<UserBugs>, UserBugs {}
const userBugsSchemaOptions = {
  timestamps: { createdAt: "created", updatedAt: "modified" },
};

var BugDocumentSchema: Schema = new Schema({
  fileType: { type: String },
  fileMode: { type: String },
  title: String,
  uniqueName: String,
  original: String
});

var userBugsSchema: Schema = new Schema({}, userBugsSchemaOptions);

userBugsSchema.add({
  userId: String,
  email: String,
  bugTitle: String,
  bugDescription: String,
  bugStatus: { type: String, enum: Object.keys(BugStatus) },
  bugDate: Date,
  bugComments: String,
  adminComments: String,
  bugFile: [{ type: BugDocumentSchema }],
});

export default userBugsSchema;
