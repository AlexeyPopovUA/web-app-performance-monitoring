import {CommonTaskProps} from "./CommoontTaskProps";

export type SingleAnalysisTask = CommonTaskProps & {
  shortPageName: string;
  url: string;
  iterations: number;
  browser: string;
}
