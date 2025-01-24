import {SingleAnalysisTask} from "../lambda/types/SingleAnalysisTask";
import {RecoveredTaskProps} from "../lambda/types/RecoveredTaskProps";

export function getSingleReportBucketKeyByTask(task: Omit<SingleAnalysisTask, 'reportPath'>) {
  return `reports/${task.projectName}/${task.environment}/${task.gitBranchOrTag}/${Date.now()}/${task.variantName}`;
}

export function getTaskParametersFromReportPath(reportPath: string): RecoveredTaskProps {
  const [, projectName, environment, gitBranchOrTag, timestamp, variantName] = reportPath.split('/');

  console.log({ projectName, environment, gitBranchOrTag, timestamp, variantName });

  return { projectName, environment, gitBranchOrTag, timestamp: new Date(timestamp).getTime(), variantName };
}