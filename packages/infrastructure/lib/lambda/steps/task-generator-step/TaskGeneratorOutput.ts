import {TaskGeneratorInput} from "./TaskGeneratorInput";
import {SingleAnalysisTask} from "../../types/SingleAnalysisTask";

export type TaskGeneratorOutput = TaskGeneratorInput & {
  concurrentTasks: SingleAnalysisTask[];
};