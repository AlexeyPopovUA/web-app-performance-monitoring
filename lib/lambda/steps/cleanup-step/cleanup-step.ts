// @ts-ignore
export async function handler(initialState): Promise<unknown> {
  console.log('cleanup', initialState);

  // TODO: Remove temporary files and resources for a complete set of reports from S3 Bucket

  return {
    ...initialState,
  };
}