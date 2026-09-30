import { Engine } from "@designable/core";
import {
  transformToSchema,
  transformToTreeNode,
} from "@designable/formily-transformer";
import { migrateLegacyBilingualProps } from "@/components/designable/src/utils/bilingual";

export const saveSchema = (designer: Engine) => {
  const schema = migrateLegacyBilingualProps(
    transformToSchema(designer.getCurrentTree()),
  );
  localStorage.setItem(
    "formily-schema",
    JSON.stringify(schema),
  );
};

export const loadInitialSchema = (designer: Engine) => {
  try {
    const raw = localStorage.getItem("formily-schema");
    if (!raw) return;
    const schema = migrateLegacyBilingualProps(JSON.parse(raw));
    designer.setCurrentTree(
      transformToTreeNode(schema),
    );
  } catch {
    return;
  }
};

export const loadSchema = (designer: Engine) => {
  return migrateLegacyBilingualProps(transformToSchema(designer.getCurrentTree()));
};
