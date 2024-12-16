import {CommonTaskProps} from "./CommoontTaskProps";

export type SingleAnalysisTask = CommonTaskProps & {
  variantName: string;
  urls: string[];
  iterations: number;
  browser: string;
  reportPath: string;
}
