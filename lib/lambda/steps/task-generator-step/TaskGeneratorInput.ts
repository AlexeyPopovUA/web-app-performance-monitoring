import type {CommonTaskProps} from "../../types/CommoontTaskProps";
import {TaskVariant} from "./TaskVariant";

export type TaskGeneratorInput = CommonTaskProps & {
  variants: TaskVariant[];
};
