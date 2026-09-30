import React from "react";
import { Button, Dropdown, Menu } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import CustomButton, { type CustomButtonProps } from "../CustomButton";

export type FooterActionItem = {
  key: React.Key;
  label: string;
  visible?: boolean;
  variant?: NonNullable<CustomButtonProps["variant"]>;
  customClassName?: string;
  disabled?: boolean;
  permissionCode?: string;
  permissionRoutePath?: string;
  onClick?: () => void;
};

export type FooterActionButtonsProps = {
  actions: FooterActionItem[];
  directLimit?: number;
  permissionRoutePath?: string;
  moreButtonClassName?: string;
};

const FooterActionButtons: React.FC<FooterActionButtonsProps> = ({
  actions,
  directLimit = 3,
  permissionRoutePath,
  moreButtonClassName = "more-btn",
}) => {
  const visibleActions = actions.filter((action) => action.visible !== false);
  const directActions = visibleActions.slice(0, directLimit);
  const moreActions = visibleActions.slice(directLimit);

  return (
    <>
      {moreActions.length > 0 && (
        <Dropdown
          overlay={
            <Menu>
              {moreActions.map((action) => (
                <Menu.Item
                  key={action.key}
                  onClick={() => action.onClick?.()}
                >
                  {action.label}
                </Menu.Item>
              ))}
            </Menu>
          }
          trigger={["click"]}
          placement="topRight"
        >
          <Button
            className={moreButtonClassName}
            icon={<MoreOutlined rotate={90} />}
          />
        </Dropdown>
      )}
      {directActions.map((action) => (
        <CustomButton
          key={action.key}
          text={action.label}
          variant={action.variant}
          customClassName={action.customClassName}
          disabled={action.disabled}
          onClick={() => action.onClick?.()}
          permissionCode={action.permissionCode}
          permissionRoutePath={action.permissionRoutePath ?? permissionRoutePath}
        />
      ))}
    </>
  );
};

export default FooterActionButtons;
