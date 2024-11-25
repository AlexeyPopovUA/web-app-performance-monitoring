import {AnalysisInitiatorInput} from "../lambda/types/AnalysisInitiatorInput";

export function getSingleReportBucketKeyByTask(task: AnalysisInitiatorInput) {
  return `reports/${task.projectName}/${task.environment}-${task.gitBranchOrTag}/${new Date().toTimeString()}/${task.browser}`;
}