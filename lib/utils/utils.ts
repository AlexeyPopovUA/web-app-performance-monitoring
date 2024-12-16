import {AnalysisInitiatorInput} from "../lambda/types/AnalysisInitiatorInput";

export function getSingleReportBucketKeyByTask(task: Omit<AnalysisInitiatorInput, 'reportPath'>) {
  return `reports/${task.projectName}/${task.environment}-${task.gitBranchOrTag}/${task.browser}/${new Date().toUTCString()}`;
}