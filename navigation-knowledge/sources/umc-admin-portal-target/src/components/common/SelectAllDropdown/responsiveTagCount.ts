export function getVisibleTagCount(
  widths: number[],
  availableWidth: number,
  gap: number,
  getRestWidth: (count: number) => number,
): number {
  if (!widths.length || availableWidth <= 0) return 0;
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total + gap * (widths.length - 1) <= availableWidth) return widths.length;
  let used = 0;
  let visible = 1;
  for (let count = 1; count < widths.length; count += 1) {
    used += widths[count - 1];
    if (used + gap * count + getRestWidth(widths.length - count) <= availableWidth) {
      visible = count;
    }
  }
  return visible;
}
