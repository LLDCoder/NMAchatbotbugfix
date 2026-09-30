import { Input } from "antd";
import type { InputProps } from "antd";
import { useMaskInputAntd } from "use-mask-input/antd";

const MAX_DIGITS = 15;
const MAX_FORMATTED_LENGTH = 18;
const EMIRATES_ID_MASK = "784-9999-9999999-9";
const EMIRATES_ID_PREFIX = "784-";

function formatEmiratesId(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, MAX_DIGITS);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 7);
  const part3 = digits.slice(7, 14);
  const part4 = digits.slice(14, 15);

  let result = part1;
  if (part2) result += `-${part2}`;
  if (part3) result += `-${part3}`;
  if (part4) result += `-${part4}`;
  return result;
}

function resolveMaskedDisplayValue(value: unknown): string {
  const rawValue = String(value ?? "");
  if (!rawValue) return "";
  const formattedValue = rawValue.includes("_")
    ? rawValue
    : rawValue.includes("-")
      ? rawValue
      : formatEmiratesId(rawValue);

  if (formattedValue.startsWith(EMIRATES_ID_PREFIX)) {
    return formattedValue.slice(EMIRATES_ID_PREFIX.length);
  }

  return formattedValue;
}

export interface EmiratesIdInputProps extends InputProps {
  value?: InputProps["value"];
  showInteractiveMask?: boolean;
}

const EmiratesIdInput: React.FC<EmiratesIdInputProps> = ({
  value = "",
  onChange,
  showInteractiveMask = false,
  maxLength,
  ...restProps
}) => {
  const maskedInputRef = useMaskInputAntd({
    mask: EMIRATES_ID_MASK,
    options: {
      placeholder: "_",
      showMaskOnFocus: true,
      showMaskOnHover: false,
      positionCaretOnClick: "lvp",
      clearIncomplete: false,
      clearMaskOnLostFocus: true,
    },
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = showInteractiveMask
      ? String(event.target.value ?? "")
      : formatEmiratesId(event.target.value);

    onChange?.({
      ...event,
      target: {
        ...event.target,
        value: nextValue,
      },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <Input
      {...restProps}
      ref={showInteractiveMask ? maskedInputRef : undefined}
      maxLength={maxLength ?? MAX_FORMATTED_LENGTH}
      value={showInteractiveMask ? resolveMaskedDisplayValue(value) : formatEmiratesId(value)}
      onChange={handleChange}
    />
  );
};

export default EmiratesIdInput;
