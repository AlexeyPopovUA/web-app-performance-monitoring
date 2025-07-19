import {AnalysisInitiatorOutput} from "./AnalysisInitiatorOutput";
import {AnalysisInitiatorInput} from "./AnalysisInitiatorInput";

export async function handler(initialState: AnalysisInitiatorInput): Promise<AnalysisInitiatorOutput> {
  const temporaryBucketName = process.env.TEMPORARY_BUCKET_NAME;
  const temporaryBucketRegion = process.env.TEMPORARY_BUCKET_REGION;
  const domainNameRelay = process.env.DOMAIN_NAME_RELAY;

  return {
    ...initialState,

    command: [
      ...initialState.urls,

      // Browser
      '--browser', initialState.browser,
      '--browsertime.iterations', initialState.iterations.toString(),
      '--browsertime.preWarmServer', 'true',
      '--browsertime.firefox.includeResponseBodies', 'html',
      '--browsertime.chrome.includeResponseBodies', 'html',
      '--browsertime.chrome.timeline', 'true',
      '--browsertime.chrome.collectConsoleLog', 'true',
      '--browsertime.chrome.collectLongTasks', 'true',
      '--browsertime.viewPort', '1920x1080',
      '--groupAlias', initialState.variantName,
      '--browsertime.visualMetrics', 'true',
      '--browsertime.visualMetricsPerceptual', 'true',
      '--browsertime.visualMetricsContentful', 'true',

      // S3 bucket configuration
      ...(temporaryBucketName ? ['--s3.bucketname', temporaryBucketName] : []),
      ...(temporaryBucketRegion ? ['--s3.region', temporaryBucketRegion] : []),
      ...(initialState.reportPath ? ['--s3.path', initialState.reportPath] : []),

      // Graphite configuration
      '--graphite.host', domainNameRelay as string,

      // Sustainable
      '--sustainable.enable', 'false',

      // Options
      '--graphite.addSlugToKey', 'true',
      '--copyLatestFilesToBase', 'true',
      // TODO Add alias support
      '--slug', 'firstView',
      '--plugins.add', '@sitespeed.io/plugin-lighthouse',
      // Debug logging level
      //'-vvv',
      //"--resultBaseURL", "https://reports.perf-mon.examples.oleksiipopov.com",

      // HTML
      //"--html.homeurl", "https://reports.perf-mon.examples.oleksiipopov.com",
      //"--html.fetchHARFiles", "true"
    ],
  };
}