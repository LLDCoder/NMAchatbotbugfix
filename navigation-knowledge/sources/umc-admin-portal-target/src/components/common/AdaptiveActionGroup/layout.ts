import type React from "react";
import type { ButtonType } from "antd/lib/button";

export type AdaptiveActionPlacement = "auto" | "inline" | "overflow";

export interface AdaptiveActionItem<ActionKey extends string = string> {
  key: ActionKey;
  label: React.ReactNode;
  onClick: () => void | Promise<void>;
  visible?: boolean;
  disabled?: boolean;
  loading?: boolean;
  priority?: number;
  placement?: AdaptiveActionPlacement;
  className?: string;
  buttonType?: ButtonType;
  danger?: boolean;
  icon?: React.ReactNode;
  renderAction?: (context: AdaptiveActionRenderContext) => React.ReactNode;
}

export interface AdaptiveActionRenderContext {
  placement: Exclude<AdaptiveActionPlacement, "auto">;
  onClick: () => void;
}

export interface AdaptiveActionLayout<ActionKey extends string = string> {
  inlineActions: AdaptiveActionItem<ActionKey>[];
  overflowActions: AdaptiveActionItem<ActionKey>[];
}

export interface ResolveAdaptiveActionLayoutOptions {
  maxInlineActions?: number;
}

export const DEFAULT_MAX_INLINE_ACTIONS = 2;

const sortActionsByPriority = <ActionKey extends string>(
  actions: readonly AdaptiveActionItem<ActionKey>[],
) => actions
  .map((action, index) => ({ action, index }))
  .sort((left, right) => (
    (left.action.priority ?? Number.MAX_SAFE_INTEGER) -
      (right.action.priority ?? Number.MAX_SAFE_INTEGER) ||
    left.index - right.index
  ))
  .map(({ action }) => action);

export const resolveAdaptiveActionLayout = <ActionKey extends string>(
  actions: readonly AdaptiveActionItem<ActionKey>[],
  options: ResolveAdaptiveActionLayoutOptions = {},
): AdaptiveActionLayout<ActionKey> => {
  const maxInlineActions = Math.max(
    0,
    options.maxInlineActions ?? DEFAULT_MAX_INLINE_ACTIONS,
  );
  const visibleActions = sortActionsByPriority(
    actions.filter((action) => action.visible !== false),
  );

  if (visibleActions.length <= maxInlineActions) {
    return {
      inlineActions: visibleActions.filter(
        (action) => action.placement !== "overflow",
      ),
      overflowActions: visibleActions.filter(
        (action) => action.placement === "overflow",
      ),
    };
  }

  const inlineActions = visibleActions.filter(
    (action) => action.placement === "inline",
  );
  const overflowActions = visibleActions.filter(
    (action) => action.placement === "overflow",
  );
  const automaticActions = visibleActions.filter(
    (action) => !action.placement || action.placement === "auto",
  );
  const availableInlineSlots = Math.max(
    0,
    maxInlineActions - inlineActions.length,
  );

  return {
    inlineActions: [
      ...inlineActions,
      ...automaticActions.slice(0, availableInlineSlots),
    ],
    overflowActions: [
      ...automaticActions.slice(availableInlineSlots),
      ...overflowActions,
    ],
  };
};

export const getAdaptiveActionColumnKeys = <
  ActionKey extends string,
  OverflowKey extends string,
>(
  actions: readonly AdaptiveActionItem<ActionKey>[],
  overflowKey: OverflowKey,
  options: ResolveAdaptiveActionLayoutOptions = {},
): Array<ActionKey | OverflowKey> => {
  const layout = resolveAdaptiveActionLayout(actions, options);
  const keys: Array<ActionKey | OverflowKey> = layout.inlineActions.map(
    (action) => action.key,
  );

  if (layout.overflowActions.length > 0) {
    keys.push(overflowKey);
  }

  return keys;
};
