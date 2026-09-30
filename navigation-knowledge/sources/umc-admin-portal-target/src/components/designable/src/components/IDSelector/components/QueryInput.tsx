import React from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import { useMaskInputAntd } from "use-mask-input/antd";
import Search from "@/assets/icons/Search";

type BaseInputProps = React.ComponentProps<typeof Input>;

interface QueryInputProps extends BaseInputProps {
  onQuery?: () => void;
  queryLoading?: boolean;
  queryLabel?: string;
  showQueryButton?: boolean;
  inputMask?: string;
}

const MaskedInput: React.FC<BaseInputProps & { mask: string }> = ({
  mask,
  ...props
}) => {
  const inputRef = useMaskInputAntd({ mask });

  return <Input {...props} ref={inputRef} />;
};

export const QueryInput: React.FC<QueryInputProps> = ({
  onQuery,
  queryLoading = false,
  queryLabel,
  showQueryButton = true,
  inputMask,
  disabled,
  ...inputProps
}) => {
  return (
    <div className="idselector-query-input">
      {inputMask ? (
        <MaskedInput {...inputProps} mask={inputMask} disabled={disabled} />
      ) : (
        <Input {...inputProps} disabled={disabled} />
      )}
      {showQueryButton && (
        <Button
          type="primary"
          className="idselector-query-btn"
          disabled={disabled || queryLoading}
          title={queryLabel}
          aria-label={queryLabel}
          icon={queryLoading ? <LoadingOutlined spin /> : <Search />}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onQuery}
        />
      )}
    </div>
  );
};

export default QueryInput;
