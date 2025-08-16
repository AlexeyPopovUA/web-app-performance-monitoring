export default {
  COMMON: {
    project: "web-perf-mon",
    region: process.env?.AWS_DEPLOYMENT_REGION || "",
    account: process.env?.AWS_ACCOUNT || "",
    defaultEnvironment: process.env?.DEFAULT_BRANCH || "main",
    // NAT gateway and public IP for the NAT gateway are expensive things for a home lab
    idleMode: process.env?.IDLE_MODE === "true" || false,
  },
  HOSTING: {
    hostedZoneID: process.env?.HOSTED_ZONE_ID || "",
    hostedZoneName: "oleksiipopov.com",
    staticDomainName: "app.perf-mon.examples.oleksiipopov.com",
    domainName: "api.perf-mon.examples.oleksiipopov.com",
    webAppBucketName: "web-perf-mon-web-app-bucket"
  },
  SECURITY: {
    apiKey: process.env?.API_KEY || `perf-mon-key-${Date.now()}` // Generate unique default key
  },
  REPORTING: {
    bucketName: "web-perf-mon-reports",
    temporaryBucketName: "web-perf-mon-reports-temp",
    staticReportBaseURL: "https://api.perf-mon.examples.oleksiipopov.com/"
  },
  ANALYSIS: {
    clusterName: 'web-perf-mon-cluster',
    taskFamily: 'web-perf-mon-task-family-sitespeedio'
  },
  NETWORKING: {
    vpcName: `vpc-with-gateway`,
    securityGroupName: `vpc-with-gateway-ecs-sg`,
    grafana: {
      graphite: {
        authSecretName: "web-perf-mon.graphite.auth",
        GRAPHITE_AUTH: process.env?.GRAPHITE_AUTH || "",
        DOMAIN_NAMESPACE_RELAY: "carbon.performance",
        DOMAIN_NAME_RELAY: "service.carbon.performance",
      }
    }
  }
};
