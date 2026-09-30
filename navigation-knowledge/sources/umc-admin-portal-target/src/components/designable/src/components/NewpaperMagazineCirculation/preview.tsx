import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import { useNodeIdProps, type DnFC } from "@designable/react";
import type { ISchema } from "@formily/react";
import { connect, mapProps } from "@formily/react";
import { observer } from "@formily/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllLocales } from "../../locales";
import { NewpaperMagazineCirculationField } from "./NewpaperMagazineCirculationField";

const newpaperMagazineCirculationSchema: ISchema = {
  type: "object",
  properties: {},
};

const ConnectedNewpaperMagazineCirculation: DnFC<
  React.ComponentProps<typeof NewpaperMagazineCirculationField>
> = connect(
  NewpaperMagazineCirculationField,
  mapProps((props, field) => ({
    ...props,
    designMode: field?.designable ? true : false,
  }))
);

export const NewpaperMagazineCirculation: DnFC<
  React.ComponentProps<typeof NewpaperMagazineCirculationField>
> = observer((props) => {
  const nodeId = useNodeIdProps();
  return (
    <div
      {...nodeId}
      className="newpaper-magazine-circulation-designable-preview-root"
    >
      <ConnectedNewpaperMagazineCirculation {...props} />
    </div>
  );
});

NewpaperMagazineCirculation.Behavior = createBehavior({
  name: "NewpaperMagazineCirculation",
  extends: ["Field"],
  selector: (node) =>
    node.props?.["x-component"] === "NewpaperMagazineCirculation",
  designerProps: {
    propsSchema: newpaperMagazineCirculationSchema,
  },
  designerLocales: AllLocales.NewpaperMagazineCirculation,
});

NewpaperMagazineCirculation.Resource = createResource({
  icon: resourceIcons.newspaperMagazineCirculation,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "newpaperMagazineCirculation",
        "x-decorator": "FormItem",
        "x-component": "NewpaperMagazineCirculation",
      },
    },
  ],
});

export default NewpaperMagazineCirculation;
