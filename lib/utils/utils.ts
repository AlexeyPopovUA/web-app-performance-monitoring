import {AnalysisInitiatorInput} from "../lambda/steps/analysis-initiator-step/AnalysisInitiatorInput";

export function getSingleReportBucketKeyByTask(task: Omit<AnalysisInitiatorInput, 'reportPath'>) {
  return `reports/${task.projectName}/${task.environment}-${task.gitBranchOrTag}/${task.browser}/${Date.now()}`;
}