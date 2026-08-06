import { IDocumentModel, IModel } from "./base";

export enum FileTypes {
  ImagePng = "image/png",
  ImageJpg = "image/jpg",
  VideoUrl = "video/url",
}

export enum FileModes {
  Standard = "Standard",
  Youtube = "Youtube",
}

export interface BugDocument {
  fileType: FileTypes;
  fileMode: FileModes;
  title: string;
  uniqueName: string;
  original: string;
}

export interface BugDocumentLite {
  fileType: string;
  title: string;
  fileMode: string,
  uniqueName: string,
}

export enum BugStatus {
  Open = "Open",
  Closed = "Closed",
  Created = "Created",
  InProgress = "InProgress",
  Resolved = "Resolved",
  Rejected = "Rejected",
}

export interface UserBugs extends IModel, IDocumentModel<UserBugs> {
  userId: string;
  email: string;
  bugTitle: string;
  bugDescription: string;
  bugStatus: BugStatus;
  bugDate: Date;
  bugComments: string;
  adminComments: string;
  bugFile: BugDocument[];
}
