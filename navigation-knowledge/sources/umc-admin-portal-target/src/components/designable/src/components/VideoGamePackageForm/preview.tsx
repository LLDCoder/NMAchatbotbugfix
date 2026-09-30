import * as React from "react";
import { createBehavior, createResource } from "@designable/core";
import type { DnFC } from "@designable/react";
import { resourceIcons } from "../../assets/resource-icons";
import { AllSchemas } from "../../schemas";
import { AllLocales } from "../../locales";
import { createFieldSchema } from "../Field";
import { VideoGamePackageFormField } from "./VideoGamePackageFormField";

export const VideoGamePackageForm: DnFC<
  React.ComponentProps<typeof VideoGamePackageFormField>
> = VideoGamePackageFormField;

const matchVideoGamePackageNode = (node: unknown) => {
  const treeNode = node as {
    props?: Record<string, unknown>;
    componentName?: unknown;
  };
  const normalize = (value: unknown) =>
    typeof value === "string"
      ? value.toLowerCase().replace(/[^a-z0-9]/g, "")
      : "";
  const candidates = [
    treeNode.props?.["x-component"],
    treeNode.props?.name,
    treeNode.props?.title,
    treeNode.componentName,
  ];
  return candidates.some(
    (value) => normalize(value).includes("videogamepackage")
  );
};

VideoGamePackageForm.Behavior = createBehavior({
  name: "VideoGamePackageForm",
  extends: ["Field"],
  selector: matchVideoGamePackageNode,
  designerProps: {
    propsSchema: AllSchemas.VideoGamePackageForm,
  },
  designerLocales: AllLocales.VideoGamePackageForm,
});

VideoGamePackageForm.Resource = createResource({
  icon: resourceIcons.videoGamePackageForm,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "VideoGamePackageForm",
        "x-decorator": "FormItem",
        "x-component": "VideoGamePackageForm",
      },
    },
  ],
});
