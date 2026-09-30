import { Form, Switch } from "antd";
import { useTranslation } from "react-i18next";
import "./index.less";

type FormItemName = string | number | Array<string | number>;

export interface HideFromCustomerFormItemProps {
  name?: FormItemName;
  className?: string;
  title?: string | null;
  description?: string | null;
  initialValue?: boolean;
  action?: number | string | null;
  externalApproval?: boolean;
  renderWhenVisible?: boolean;
}

const DEFAULT_NAME = "hideFromCustomer";
const I18N_PREFIX = "sharedComponents.hideFromCustomerFormItem";
const DEFAULT_TITLE = "Hide From Customer";
const DEFAULT_DESCRIPTION =
  "When on, the rejection reason, notes, and attachments are visible only on the internal timeline and not in the customer portal.";
const ALWAYS_VISIBLE_ACTIONS = new Set(["101", "202"]);
const MEDIA_REPORT_ACTIONS = new Set(["104", "105", "106", "107"]);

const shouldRenderByAction = (
  action?: number | string | null,
  externalApproval?: boolean,
) => {
  const normalizedAction =
    action === null || action === undefined ? "" : String(action);

  if (ALWAYS_VISIBLE_ACTIONS.has(normalizedAction)) {
    return true;
  }

  if (MEDIA_REPORT_ACTIONS.has(normalizedAction)) {
    return externalApproval !== true;
  }

  return false;
};

const HideFromCustomerFormItem = ({
  name = DEFAULT_NAME,
  className,
  title,
  description,
  initialValue = false,
  action,
  externalApproval,
  renderWhenVisible,
}: HideFromCustomerFormItemProps) => {
  const { t } = useTranslation();
  const shouldRender =
    renderWhenVisible === true || shouldRenderByAction(action, externalApproval);
  if (!shouldRender) {
    return null;
  }

  const resolvedTitle =
    title ??
    String(t(`${I18N_PREFIX}.title`, { defaultValue: DEFAULT_TITLE }));
  const resolvedDescription =
    description ??
    String(
      t(`${I18N_PREFIX}.description`, {
        defaultValue: DEFAULT_DESCRIPTION,
      }),
    );

  const itemClassName = [
    "hide-from-customer-form-item",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Form.Item className={itemClassName}>
      <div className="hide-from-customer-form-item__content">
        <div className="hide-from-customer-form-item__copy">
          <div className="hide-from-customer-form-item__title">
            {resolvedTitle}
          </div>
          <div className="hide-from-customer-form-item__description">
            {resolvedDescription}
          </div>
        </div>
        <Form.Item
          name={name}
          valuePropName="checked"
          initialValue={initialValue}
          noStyle
        >
          <Switch className="two-factor-switch  hide-from-customer-form-item__switch" />
        </Form.Item>
      </div>
    </Form.Item>
  );
};

export default HideFromCustomerFormItem;
