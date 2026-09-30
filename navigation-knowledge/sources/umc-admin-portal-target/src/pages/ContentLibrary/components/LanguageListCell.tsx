import { Tooltip } from "antd";

type LanguageListCellProps = {
  value: unknown;
  emptyText?: string;
};

const MAX_VISIBLE_LANGUAGES = 5;

export default function LanguageListCell({
  value,
  emptyText = "",
}: LanguageListCellProps) {
  const languages = (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .filter(Boolean);

  if (languages.length === 0) {
    return <>{emptyText}</>;
  }

  const fullLanguageList = languages.join(", ");
  if (languages.length <= MAX_VISIBLE_LANGUAGES) {
    return <>{fullLanguageList}</>;
  }

  const visibleLanguageList = languages
    .slice(0, MAX_VISIBLE_LANGUAGES)
    .join(", ");

  return (
    <Tooltip title={fullLanguageList}>
      <span>{`${visibleLanguageList}, ...`}</span>
    </Tooltip>
  );
}
