import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dropdown, Menu } from "antd";
import type { DropdownProps } from "antd/lib/dropdown";
import type { ButtonType } from "antd/lib/button";
import { LoadingOutlined } from "@ant-design/icons";
import {
  DEFAULT_MAX_INLINE_ACTIONS,
  resolveAdaptiveActionLayout,
  type AdaptiveActionItem,
} from "./layout";
import "./index.less";

export interface AdaptiveActionGroupProps<ActionKey extends string = string> {
  actions: readonly AdaptiveActionItem<ActionKey>[];
  maxInlineActions?: number;
  moreLabel: string;
  moreIcon: React.ReactNode;
  buttonType?: ButtonType;
  className?: string;
  emptyContent?: React.ReactNode;
  dropdownPlacement?: DropdownProps["placement"];
  dropdownOverlayClassName?: string;
  destroyPopupOnHide?: boolean;
  menuClassName?: string;
  moreButtonClassName?: string;
  emptyClassName?: string;
}

type DropdownVisibilityListener = (activeId: symbol | null) => void;

const dropdownVisibilityListeners = new Set<DropdownVisibilityListener>();
let activeDropdownId: symbol | null = null;

const publishActiveDropdown = (activeId: symbol | null) => {
  activeDropdownId = activeId;
  dropdownVisibilityListeners.forEach((listener) => listener(activeId));
};

const AdaptiveActionGroup = <ActionKey extends string>({
  actions,
  maxInlineActions = DEFAULT_MAX_INLINE_ACTIONS,
  moreLabel,
  moreIcon,
  buttonType = "link",
  className = "",
  emptyContent = "-",
  dropdownPlacement = "bottomRight",
  dropdownOverlayClassName,
  destroyPopupOnHide,
  menuClassName = "",
  moreButtonClassName = "",
  emptyClassName = "",
}: AdaptiveActionGroupProps<ActionKey>) => {
  const dropdownIdRef = useRef(Symbol("adaptive-action-group"));
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const layout = useMemo(
    () => resolveAdaptiveActionLayout(actions, { maxInlineActions }),
    [actions, maxInlineActions],
  );

  const stopPropagation = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handleMenuItemMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const closeDropdown = useCallback(() => {
    if (activeDropdownId === dropdownIdRef.current) {
      publishActiveDropdown(null);
      return;
    }

    setDropdownVisible(false);
  }, []);

  const handleDropdownVisibleChange = useCallback((visible: boolean) => {
    if (visible) {
      publishActiveDropdown(dropdownIdRef.current);
      return;
    }

    closeDropdown();
  }, [closeDropdown]);

  const executeAction = useCallback(
    (action: AdaptiveActionItem<ActionKey>) => {
      if (action.disabled || action.loading) {
        return;
      }

      void action.onClick();
    },
    [],
  );

  useEffect(() => {
    const dropdownId = dropdownIdRef.current;
    const handleActiveDropdownChange: DropdownVisibilityListener = (
      activeId,
    ) => {
      setDropdownVisible(activeId === dropdownId);
    };

    dropdownVisibilityListeners.add(handleActiveDropdownChange);

    return () => {
      dropdownVisibilityListeners.delete(handleActiveDropdownChange);
      if (activeDropdownId === dropdownId) {
        publishActiveDropdown(null);
      }
    };
  }, []);

  if (layout.inlineActions.length === 0 && layout.overflowActions.length === 0) {
    if (emptyContent === null) {
      return null;
    }

    return (
      <span
        className={["adaptive-action-group__empty", emptyClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {emptyContent}
      </span>
    );
  }

  const overlay = (
    <Menu
      className={["adaptive-action-group__menu", menuClassName]
        .filter(Boolean)
        .join(" ")}
      items={layout.overflowActions.map((action) => ({
        key: action.key,
        disabled: action.disabled || action.loading,
        label: (
          <span
            className={action.className}
            onMouseDown={handleMenuItemMouseDown}
          >
            {action.loading ? <LoadingOutlined /> : action.icon}
            {action.label}
          </span>
        ),
      }))}
      onClick={({ key, domEvent }) => {
        domEvent.stopPropagation();
        const action = layout.overflowActions.find(
          (item) => String(item.key) === String(key),
        );
        closeDropdown();
        if (action) {
          executeAction(action);
        }
      }}
    />
  );

  return (
    <div
      className={["adaptive-action-group", className].filter(Boolean).join(" ")}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      {layout.inlineActions.map((action) => (
        <React.Fragment key={action.key}>
          {action.renderAction ? (
            action.renderAction({
              placement: "inline",
              onClick: () => executeAction(action),
            })
          ) : (
            <Button
              className={action.className}
              type={action.buttonType ?? buttonType}
              danger={action.danger}
              icon={action.icon}
              loading={action.loading}
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation();
                executeAction(action);
              }}
            >
              {action.label}
            </Button>
          )}
        </React.Fragment>
      ))}
      {layout.overflowActions.length > 0 ? (
        <Dropdown
          overlay={overlay}
          trigger={["click"]}
          placement={dropdownPlacement}
          overlayClassName={dropdownOverlayClassName}
          destroyPopupOnHide={destroyPopupOnHide}
          visible={dropdownVisible}
          onVisibleChange={handleDropdownVisibleChange}
        >
          <Button
            type="text"
            className={[
              "adaptive-action-group__more-button",
              moreButtonClassName,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={moreLabel}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            icon={moreIcon}
          />
        </Dropdown>
      ) : null}
    </div>
  );
};

export type { AdaptiveActionItem } from "./layout";
export default AdaptiveActionGroup;
