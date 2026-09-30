# KeepAlive

This folder contains a lightweight route-level keep-alive solution for React Router v5 pages in this project.

The goal is simple:

- Keep selected list pages mounted when the user navigates to related sibling routes such as detail pages
- Restore the previous list query state when the user explicitly navigates back
- Expose activation and deactivation hooks so pages can refresh data or clean up transient UI state

This implementation is intentionally route-focused. It is not a general-purpose component cache for arbitrary nested UI trees.

## When To Use

Use this keep-alive flow when:

- A list page is expensive to rebuild
- The page contains filters, tabs, pagination, or scroll-adjacent state that should survive route switches
- A sibling detail page should temporarily replace the list without fully unmounting it

Typical example:

- Refund list page stays mounted
- Refund detail page opens as a sibling route
- Clicking Back restores the previous list query state

## Core Idea

Routes that belong to the same flow are linked by route metadata in `src/routes/keepAlive.ts`.

Inside one keep-alive group:

- `cache` routes stay mounted while inactive
- `route` routes behave like normal routes and remount when entered

The keep-alive layer tracks:

- current active pathname
- previous active pathname
- current active pathname + search
- previous active pathname + search

That information is used by hooks to:

- detect activation and deactivation
- inspect where the user came from
- restore cached list query state when the navigation explicitly asks for it

## File Overview

### `constants.ts`

Shared constants for the keep-alive flow.

Currently it defines:

- `KEEP_ALIVE_RESTORE_STATE_KEY`

This route-state flag is used to explicitly tell a cached list page that it should restore the last saved query state.

### `context.ts`

React contexts shared inside a keep-alive route group.

It provides:

- group-level route state through `KeepAliveContext`
- item-level cache identity through `KeepAliveItemContext`

These contexts are internal plumbing for the hooks in this folder.

### `index.tsx`

The `KeepAlive` provider component.

Responsibilities:

- store the current active route key
- remember the previous active route key
- store the current full location key (`pathname + search`)
- remember the previous full location key

This is the source of truth used by activation and restore hooks.

### `KeepAliveItem.tsx`

Wraps one cached route.

Responsibilities:

- mount the route subtree the first time it becomes active
- keep the subtree mounted while inactive
- hide inactive content from layout and accessibility
- refresh the cached node when the route becomes active again

Important behavior:

- inactive cached pages are hidden, not unmounted
- page-level cleanup is still your responsibility

If a cached page opens modals, drawers, dropdowns, or other portal-based UI, the page should clean that state up in `onDeactivated`

### `KeepAliveRouteGroup.tsx`

Builds one keep-alive route group from route definitions.

Responsibilities:

- read the current router location
- compute the active pathname and full location key
- render cached routes with `KeepAliveItem`
- render non-cached sibling routes normally

This component is the bridge between route config and the low-level keep-alive primitives.

### `useKeepAliveActivated.ts`

Hook for route activation lifecycle.

It exposes:

- `onActivated`
- `onDeactivated`
- `fireOnFirstMount`

Use it when a cached page needs to:

- refresh data after returning from a sibling route
- clear transient UI state when it becomes inactive
- inspect the previous route and query params

The `onActivated` callback receives:

- `from`
- `fromPath`
- `fromQuery`
- `fromParsed`

### `useKeepAliveRouteState.ts`

Hook for restoring the last cached route state.

Use it in a cached list page when:

- the page should keep its latest `search` state while cached
- that state should only be restored under specific navigation conditions

Responsibilities:

- keep a frozen copy of the latest active location
- detect whether the current navigation is an explicit restore
- return the effective pathname and search that the page should use

This is how a cached list page can continue reading the previous query state even when the current URL is a clean list path.

### `utils.ts`

Small helpers for parsing route keys.

Currently it provides:

- `parseLocationKey`

This converts a `pathname?query` string into:

- `path`
- parsed query object

Repeated query params are preserved as arrays.

## Route Configuration

Keep-alive participation is declared in route metadata.

See `src/routes/keepAlive.ts`:

```ts
export type KeepAliveRouteMeta = {
  group: string;
  mode: "cache" | "route";
};
```

Meaning:

- `group`: links related routes into the same keep-alive flow
- `mode: "cache"`: keep this route mounted when inactive
- `mode: "route"`: render this route normally, but keep it in the same activation flow

Example:

```ts
{
  path: "/happiness/refunds",
  page: "CustomerRefunds",
  keepAlive: {
    group: "customer-refunds",
    mode: "cache",
  },
  children: [
    {
      path: "/happiness/refunds/refundsDetails",
      page: "CustomerRefundsDetails",
      keepAlive: {
        group: "customer-refunds",
        mode: "route",
      },
    },
  ],
}
```

## How To Add A New Keep-Alive Flow

### 1. Mark the related routes

Add `keepAlive` metadata in `src/routes/index.tsx`.

- Put all related routes in the same `group`
- Mark the list page as `cache`
- Mark detail or sibling pages as `route`

### 2. Use `useKeepAliveRouteState` in the cached page

Example:

```ts
const { activated, effectivePathname, effectiveSearch } =
  useKeepAliveRouteState({
    restorePathname: LIST_PATH,
    restoreFrom: [DETAIL_PATH],
    restoreStateKey: KEEP_ALIVE_RESTORE_STATE_KEY,
  });
```

Use `effectiveSearch` instead of `location.search` when reading list query state.

### 3. Use `useKeepAliveActivated` for lifecycle behavior

Example:

```ts
useKeepAliveActivated({
  onActivated: () => {
    void loadList();
  },
  onDeactivated: () => {
    setModalOpen(false);
    setSelectedRecord(null);
  },
});
```

Typical usage:

- `onActivated`: refresh data or recalculate page state
- `onDeactivated`: close modals, reset selected rows, clear transient UI state

### 4. Explicitly mark “restore list state” navigations

When a detail page should return to the cached list state, push the list route with the restore flag:

```ts
history.push(LIST_PATH, {
  [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
});
```

Without that flag, the list page will behave like a normal fresh navigation.

## Current Example In This Repo

Current keep-alive flow:

- `CustomerRefunds` list page
- `CustomerRefundsDetails` detail page

Behavior:

- list page stays mounted while detail page is open
- detail Back explicitly restores the cached list query state
- list page refreshes on activation
- list page closes transient modals on deactivation

### Example: `src/pages/CustomerRefunds/index.tsx`

`src/pages/CustomerRefunds/index.tsx` uses the keep-alive hooks in two places.

First, it restores the cached list query state only when navigation explicitly asks for it:

```ts
const { activated, effectivePathname, effectiveSearch } =
  useKeepAliveRouteState({
    restorePathname: CUSTOMER_REFUNDS_PATH,
    restoreFrom: [CUSTOMER_REFUNDS_DETAILS_PATH],
    restoreStateKey: KEEP_ALIVE_RESTORE_STATE_KEY,
  });
```

Then it uses activation lifecycle hooks to refresh data and clear transient UI state:

```ts
useKeepAliveActivated({
  onActivated: () => {
    void loadList();
  },
  onDeactivated: () => {
    setFilterOpen(false);
    setStatusOpen(false);
    setTransferOpen(false);
    setSelectedRecord(null);
  },
});
```

In practice this means:

- the refund list page keeps its mounted state while the detail page is open
- list query-driven state is read from `effectiveSearch` instead of directly from `location.search`
- modal and selection state is cleared when the page becomes inactive

### Example: `src/pages/CustomerRefundsDetails/index.tsx`

`src/pages/CustomerRefundsDetails/index.tsx` explicitly marks the Back navigation as a restore action:

```ts
history.push("/happiness/refunds", {
  [KEEP_ALIVE_RESTORE_STATE_KEY]: true,
});
```

That flag is important.

Without it:

- the list route would behave like a fresh visit
- the cached search state would not be restored intentionally

With it:

- `CustomerRefunds` knows this navigation came from the detail page
- the last frozen list query state can be reused safely

## Limitations

This implementation does not automatically preserve everything.

What it does preserve:

- mounted React subtree for cached routes
- page-local state that remains in that mounted subtree
- frozen route search state when `useKeepAliveRouteState` is used

What it does not automatically handle:

- portal UI cleanup such as modal or dropdown visibility
- scroll restoration
- cache eviction
- nested keep-alive trees
- cross-tab or persisted cache recovery after full reload

## Practical Guidance

Before adding a page to keep-alive, verify:

- the page really benefits from staying mounted
- the page can safely remain mounted in the background
- transient UI state is cleaned up in `onDeactivated`
- the “Back” path should restore state explicitly, not implicitly

If a page only needs normal route navigation, do not add keep-alive metadata.
