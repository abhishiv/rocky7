export const getValueUsingPath = (
  record: Record<string, any>,
  path: string[]
) => path.reduce((record, item) => record[item], record);
