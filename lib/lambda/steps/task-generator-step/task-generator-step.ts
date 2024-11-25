import {TaskGeneratorStepInput} from "../../types/TaskGeneratorStepInput";
import {TaskGeneratorOutput} from "../../types/TaskGeneratorOutput";

export async function handler(initialState: TaskGeneratorStepInput): Promise<TaskGeneratorOutput> {
  return {
    // preserve the initial state
    ...initialState,
    // generate concurrent tasks
    concurrentTasks: initialState.variants.reduce<TaskGeneratorOutput['concurrentTasks']>((acc, item) => {
      // split concurrent tasks by browsers
      item.browsers.forEach(browser => {
        acc.push({
          // common
          projectName: initialState.projectName,
          baseUrl: initialState.baseUrl,
          environment: initialState.environment,
          gitBranchOrTag: initialState.gitBranchOrTag,

          // specific
          shortPageName: item.shortPageName,
          url: item.url,
          iterations: item.iterations,
          browser: browser
        });
      });
      return acc;
    }, [])
  };
}