type ScrollWhenReadyOptions = {
  delay?: number;
  maxAttempts?: number;
  offset?: number;
};

export function scrollElementInPageContent(
  element: HTMLElement,
  offset = 80,
): void {
  const scrollContainer = element.closest<HTMLElement>(".page-content-scroll");

  if (!scrollContainer) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  const nextScrollTop =
    scrollContainer.scrollTop + targetRect.top - containerRect.top - offset;

  scrollContainer.scrollTo({
    top: Math.max(nextScrollTop, 0),
    behavior: "smooth",
  });
}

export function scrollWhenReady(
  getElement: () => HTMLElement | null,
  options: ScrollWhenReadyOptions = {},
): () => void {
  const { delay = 200, maxAttempts = 5, offset = 80 } = options;
  let cancelled = false;
  let timeoutId = 0;
  let attempts = 0;

  const run = () => {
    if (cancelled) {
      return;
    }

    const element = getElement();
    if (element) {
      scrollElementInPageContent(element, offset);
      return;
    }

    if (attempts < maxAttempts) {
      attempts += 1;
      timeoutId = window.setTimeout(run, 100);
    }
  };

  timeoutId = window.setTimeout(run, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
}
