export type SingleReport = {
  projectName: string;
  variantName: string;
  environment: string;
  date: string;
  path: string;
};

export type GroupedReports = {
  [projectName: string]: {
    [environment: string]: {
      [variantName: string]: SingleReport[];
    };
  };
};