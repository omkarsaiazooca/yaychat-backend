import { IDocumentModel, IModel } from "./base";

export type TutorialApp = "BTCY" | "BTCY_PLAN";

export interface TutorialWatch extends IModel, IDocumentModel<TutorialWatch> {
  email: string;
  emailLower: string;
  app: TutorialApp;
  watched: boolean;
  watchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
