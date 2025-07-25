export type TaskVariant = {
  variantName: string;
  urls: string[];
  iterations: number;
  browser: 'chrome' | 'firefox' | 'edge';
}