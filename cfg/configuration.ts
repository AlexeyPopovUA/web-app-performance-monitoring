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
    // todo Migrate task API to the generic public API gateway
    taskApiDomainName: "task.perf-mon.examples.oleksiipopov.com",
    apiDomainName: "api.perf-mon.examples.oleksiipopov.com"
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
    vpcName: `vpc-with-gateway`,
    securityGroupName: `vpc-with-gateway-ecs-sg`,
    // NAT gateway and public IP for the NAT gateway are expensive things for a home lab
    enableNetworkEgress: process.env?.ENABLE_NETWORK_EGRESS === "true" || false,
    grafana: {
      graphite: {
        authSecretName: "web-perf-mon.graphite.auth",
        host: "graphite-prod-24-prod-eu-west-2.grafana.net",
        user: "1729306", // TODO: Take from a secret manager,
        GRAPHITE_AUTH: process.env?.GRAPHITE_AUTH || ""
      }
    }
  }
};
