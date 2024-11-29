export default {
  COMMON: {
    project: "web-perf-mon",
    region: process.env?.AWS_DEPLOYMENT_REGION || "",
    account: process.env?.AWS_ACCOUNT || "",
    defaultEnvironment: process.env?.DEFAULT_BRANCH || "main"
  },
  HOSTING: {
    hostedZoneID: process.env?.HOSTED_ZONE_ID || "",
    hostedZoneName: "oleksiipopov.com",
    staticDomainName: "oleksiipopov.com",
    apiDomainName: "task.perf-mon.examples.oleksiipopov.com"
  },
  REPORTING: {
    bucketName: "web-perf-mon-reports",
    temporaryBucketName: "web-perf-mon-reports-temp",
    reportsDomainName: "reports.perf-mon.examples.oleksiipopov.com"
  },
  ANALYSIS: {
    clusterName: 'web-perf-mon-cluster',
    taskFamily: 'web-perf-mon-task-family-sitespeedio'
  },
  NETWORKING: {
    securityGroupName: `web-perf-mon-ecs-sg`,
  }
};
