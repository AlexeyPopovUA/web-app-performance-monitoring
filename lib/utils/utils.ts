import {SingleAnalysisTask} from "../lambda/types/SingleAnalysisTask";

export function getSingleReportBucketKeyByTask(task: Omit<SingleAnalysisTask, 'reportPath'>) {
  return `reports/${task.projectName}/${task.environment}/${task.gitBranchOrTag}/${task.browser}/${Date.now()}/${task.variantName}`;
}