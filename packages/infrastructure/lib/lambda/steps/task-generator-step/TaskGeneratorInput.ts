import type {CommonTaskProps} from "../../types/CommonTaskProps";
import {TaskVariant} from "./TaskVariant";

export type TaskGeneratorInput = CommonTaskProps & {
  variants: TaskVariant[];
};
