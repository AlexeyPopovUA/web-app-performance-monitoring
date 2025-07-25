import {TaskGeneratorInput} from "./TaskGeneratorInput";
import {TaskGeneratorOutput} from "./TaskGeneratorOutput";
import {getSingleReportBucketKeyByTask} from "../../../utils/utils";

export async function handler(initialState: TaskGeneratorInput): Promise<TaskGeneratorOutput> {
  return {
    // preserve the initial state
    ...initialState,
    // generate concurrent tasks
    concurrentTasks: initialState.variants.reduce<TaskGeneratorOutput['concurrentTasks']>((acc, item) => {
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
        browser: item.browser,
      }

      acc.push({
        ...cfg,

        reportPath: getSingleReportBucketKeyByTask(cfg)
      });

      return acc;
    }, [])
  };
}