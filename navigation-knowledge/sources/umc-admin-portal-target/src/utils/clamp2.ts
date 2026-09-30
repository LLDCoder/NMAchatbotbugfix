export default function truncateTextToTwoLines(el: HTMLDivElement | HTMLSpanElement, moreText = '...') {
  if(!el) return ;
  if (!el.dataset.originalText) {
    el.dataset.originalText = el.textContent.trim();
  }
  const originalText = el.dataset.originalText;
  el.textContent = originalText;
  el.style.overflow = 'visible';
  
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  const twoLineHeight = lineHeight * 2;
  const actualHeight = el.offsetHeight;

  if (actualHeight > twoLineHeight) {
    let truncatedText = originalText;
    el.textContent = truncatedText;
    while (el.offsetHeight > twoLineHeight && truncatedText.length > 0) {
      truncatedText = truncatedText.slice(0, -1);
      el.textContent = truncatedText + moreText;
    }
  }
  
  el.style.overflow = 'hidden';
  el.style.lineHeight = lineHeight + 'px';
}