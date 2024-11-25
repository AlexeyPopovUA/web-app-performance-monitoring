import {TaskGeneratorStepInput} from "./TaskGeneratorStepInput";
import {SingleAnalysisTask} from "./SingleAnalysisTask";

export type TaskGeneratorOutput = TaskGeneratorStepInput & {
  concurrentTasks: SingleAnalysisTask[];
};