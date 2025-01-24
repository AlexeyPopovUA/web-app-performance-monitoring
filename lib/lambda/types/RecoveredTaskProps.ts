import {CommonTaskProps} from "./CommonTaskProps";

export type RecoveredTaskProps = Omit<CommonTaskProps, 'baseUrl'> & {
  timestamp: number;
  variantName: string;
}