/**
 * Convert pixel values to rem strings based on a 16px base.
 * @param px The pixel value to convert
 * @param base The base font size in pixels (default 16)
 * @returns The converted rem string
 */
export const pxToRemValue = (px: number, base = 16): string => {
  return `${px / base}rem`;
};
