import {CommonTaskProps, TaskPayload} from "../../types/TaskPayload";

type SingleAnalysisJob = CommonTaskProps & {
  shortPageName: string;
  url: string;
  iterations: number;
  browser: string;
}

type GeneratedTaskState = TaskPayload & {
  concurrentTasks: SingleAnalysisJob[];
};

export async function handler(initialState: TaskPayload): Promise<GeneratedTaskState> {
  console.log('initialState', initialState);

  return {
    ...initialState,
    concurrentTasks: initialState.urls.reduce<GeneratedTaskState['concurrentTasks']>((acc, item) => {
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