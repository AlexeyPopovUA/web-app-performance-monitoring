export type CommonTaskProps = {
  projectName: string;
  baseUrl: string;
  environment: string;
  gitBranchOrTag?: string;
};

export type TaskPayload = CommonTaskProps & {
  urls: {
    shortPageName: string;
    url: string;
    iterations: number;
    browsers: string[];
  }[];
};
