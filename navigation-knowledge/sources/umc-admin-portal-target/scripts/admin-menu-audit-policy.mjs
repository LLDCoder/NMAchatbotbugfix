export function detectPageFailure({
  routeStatusVisible,
  resultTitle,
  diagnosticText,
}) {
  if (!routeStatusVisible) return "";

  const detail = resultTitle || diagnosticText;
  if (!detail) return "";

  return `route status displayed: ${detail}`;
}
