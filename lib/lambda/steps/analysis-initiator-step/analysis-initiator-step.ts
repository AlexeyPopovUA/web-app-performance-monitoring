// @ts-ignore
export async function handler(initialState): Promise<unknown> {
  console.log('initiator', initialState);

  // TODO: Convert incoming tasks object into a Fargate Task Run definition, compatible with the fargate task runner step

  return {
    ...initialState,
  };
}