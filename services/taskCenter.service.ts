import { TaskCenter } from "../data/taskCenter";
import taskCenterSchema, { TaskCenterModel } from "../models/taskCenter";
import { ServiceBase } from "./base";

export class TaskCenterService extends ServiceBase<
  TaskCenter,
  TaskCenterModel
> {
  constructor() {
    super(taskCenterSchema, "TaskCenter");
  }

}