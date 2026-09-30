const hasText = (value?: string | null): value is string =>
  typeof value === "string" && value.trim().length > 0;
export default hasText;
