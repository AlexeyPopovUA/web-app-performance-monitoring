import {TaskGeneratorStepInput} from "../../types/TaskGeneratorStepInput";
import {TaskGeneratorOutput} from "../../types/TaskGeneratorOutput";
import {getSingleReportBucketKeyByTask} from "../../../utils/utils";

export async function handler(initialState: TaskGeneratorStepInput): Promise<TaskGeneratorOutput> {
  return {
    // preserve the initial state
    ...initialState,
    // generate concurrent tasks
    concurrentTasks: initialState.variants.reduce<TaskGeneratorOutput['concurrentTasks']>((acc, item) => {
      // split concurrent tasks by browsers
      item.browsers.forEach(browser => {
        const cfg = {
          // common
          projectName: initialState.projectName,
          baseUrl: initialState.baseUrl,
          environment: initialState.environment,
          gitBranchOrTag: initialState.gitBranchOrTag,

          // specific
          variantName: item.variantName,
          urls: item.urls,
          iterations: item.iterations,
          browser: browser,
        }

        acc.push({
          ...cfg,

          reportPath: getSingleReportBucketKeyByTask(cfg)
        });
      });
      return acc;
    }, [])
  };
}