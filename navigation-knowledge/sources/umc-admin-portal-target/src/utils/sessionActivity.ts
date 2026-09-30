export const SESSION_ACTIVITY_EVENT = "auth:session-activity";

export function notifySessionActivity() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
}
