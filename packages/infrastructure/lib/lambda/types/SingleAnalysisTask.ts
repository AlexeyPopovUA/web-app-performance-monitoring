import {CommonTaskProps} from "./CommonTaskProps";

export type SingleAnalysisTask = CommonTaskProps & {
  variantName: string;
  urls: string[];
  iterations: number;
  browser: string;
  reportPath: string;
}
