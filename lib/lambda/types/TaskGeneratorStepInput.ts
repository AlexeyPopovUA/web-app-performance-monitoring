import type {CommonTaskProps} from "./CommoontTaskProps";
import {TaskVariant} from "./TaskVariant";

export type TaskGeneratorStepInput = CommonTaskProps & {
  variants: TaskVariant[];
};
