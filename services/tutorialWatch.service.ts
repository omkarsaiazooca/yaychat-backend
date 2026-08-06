import { ServiceBase } from "./base";
import TutorialWatchSchema, { TutorialWatchModel } from "../models/tutorialWatch";
import { TutorialWatch } from "../data/tutorialWatch";

export class TutorialWatchService extends ServiceBase<
  TutorialWatch,
  TutorialWatchModel
> {
  constructor() {
    super(TutorialWatchSchema, "TutorialWatch");
  }
}
