import {AnalysisInitiatorOutput} from "../../types/AnalysisInitiatorOutput";
import {AnalysisInitiatorInput} from "../../types/AnalysisInitiatorInput";

export async function handler(initialState: AnalysisInitiatorInput): Promise<AnalysisInitiatorOutput> {
  console.log('initiator', initialState);

  // TODO: Convert incoming tasks object into a Fargate Task Run definition, compatible with the fargate task runner step

  return {
    ...initialState,
  };
}