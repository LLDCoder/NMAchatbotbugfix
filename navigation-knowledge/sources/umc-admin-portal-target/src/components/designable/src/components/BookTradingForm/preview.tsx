import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import { observer, type ISchema } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { BookTradingFormField } from "./BookTradingFormField";

const bookTradingFormPropsSchema: ISchema = {
  type: "object",
  properties: {},
};

export const BookTradingForm: DnFC<Record<string, unknown>> = observer(
  (props) => {
    const nodeId = useNodeIdProps();
    return (
      <div {...nodeId} className="book-trading-form-designable-preview-root">
        <BookTradingFormField {...props} />
      </div>
    );
  },
);

BookTradingForm.Behavior = createBehavior({
  name: "BookTradingForm",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "BookTradingForm",
  designerProps: {
    propsSchema: bookTradingFormPropsSchema,
  },
  designerLocales: AllLocales.BookTradingForm,
});

BookTradingForm.Resource = createResource({
  icon: resourceIcons.bookTradingForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "BookTrading",
        title: "",
        "x-decorator": "FormItem",
        "x-component": "BookTradingForm",
        "x-decorator-props": { colon: false, label: false },
        "x-component-props": {},
      },
    },
  ],
});
