export const PAGE_CONTENT_SCROLL_TO_TOP_EVENT =
  "layout:page-content-scroll-to-top";
export const PAGE_CONTENT_SCROLL_REQUEST_EVENT =
  "layout:page-content-scroll-request";

let pageContentScrollTop = 0;

export const recordPageContentScrollTop = (scrollTop: number) => {
  if (Number.isFinite(scrollTop) && scrollTop >= 0) {
    pageContentScrollTop = scrollTop;
  }
};

export const getPageContentScrollTop = () => pageContentScrollTop;

export const requestPageContentScrollTo = (top: number) => {
  if (typeof window === "undefined" || !Number.isFinite(top) || top < 0) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(PAGE_CONTENT_SCROLL_REQUEST_EVENT, {
      detail: { top },
    }),
  );
};

/*
  Layout owns the shared SimpleBar instance, but individual pages may still need
  to reset it when filters, departments, or role-specific dashboards change.
  This helper avoids page code reaching into Layout's DOM structure directly.
*/
export const requestPageContentScrollToTop = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(PAGE_CONTENT_SCROLL_TO_TOP_EVENT));
};
