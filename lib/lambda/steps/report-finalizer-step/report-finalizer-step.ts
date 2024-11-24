// @ts-ignore
export async function handler(initialState): Promise<unknown> {
  console.log('finalizer', initialState);

  return {
    ...initialState,
  };
}