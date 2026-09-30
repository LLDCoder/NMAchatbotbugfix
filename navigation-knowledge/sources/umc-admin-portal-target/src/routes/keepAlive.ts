// Marks routes that participate in the same keep-alive navigation flow.
// `group` links related routes together, while `mode` decides whether
// the route should stay mounted (`cache`) or behave like a normal route (`route`).
export type KeepAliveRouteMeta = {
  group: string;
  mode: "cache" | "route";
};
