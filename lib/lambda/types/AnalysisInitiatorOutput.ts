import {AnalysisInitiatorInput} from "./AnalysisInitiatorInput";

export type AnalysisInitiatorOutput = AnalysisInitiatorInput & {
  command: string[];
}