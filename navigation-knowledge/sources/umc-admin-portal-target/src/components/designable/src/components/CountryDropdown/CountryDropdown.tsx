import { useEffect, useMemo, useState } from "react";
import { connect, mapProps, mapReadPretty, useField, useForm } from "@formily/react";
import { Select as AntdSelect, type SelectProps } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { PreviewText } from "@formily/antd";
import { getNationalityList, type NationalityInfo } from "@/services/userProfile";
import {
  getCountryCode,
  getFlagImage,
  getLocalizedCountryLabel,
  type CountryOption,
} from './countries';
import './index.less';
import { useTranslation } from "react-i18next";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";

interface CountryDropdownProps {
  value?: string | number | Array<string | number>;
  onChange?: (value: string | string[]) => void;
  [key: string]: unknown;
}

type LocalizedCountryOption = CountryOption & {
  labelEn?: string;
  labelAr?: string;
  nameEn?: string;
  nameAr?: string;
  displayLabel?: string;
};

function resolveCountryDropdownPlaceholder(
  props: {
    placeholderEn?: unknown;
    placeholderAr?: unknown;
    placeholder?: unknown;
  },
  lang: string | undefined,
): string | undefined {
  const isAr = (lang ?? "en").toLowerCase().startsWith("ar");
  const ph = isAr
    ? props.placeholderAr ?? props.placeholderEn ?? props.placeholder
    : props.placeholderEn ?? props.placeholderAr ?? props.placeholder;
  return typeof ph === "string" ? ph : undefined;
}

function normalizeNationalityText(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") {
    return undefined;
  }

  return trimmed;
}

function mapNationalityToCountryOption(item: NationalityInfo): CountryOption | null {
  const countryCode = normalizeNationalityText(item.isocode2)?.toUpperCase();
  if (!countryCode) {
    return null;
  }

  const value = String(item.id).trim();
  if (!value) {
    return null;
  }

  const nameEn =
    normalizeNationalityText(item.nameEn) ||
    normalizeNationalityText(item.fullNameEn) ||
    countryCode;
  const nameAr =
    normalizeNationalityText(item.nameAr) ||
    normalizeNationalityText(item.fullNameAr);

  return {
    value,
    countryCode,
    label: nameEn,
    labelAr: nameAr,
    nameEn,
    nameAr,
  };
}

function normalizeCountryDropdownValue(
  value: CountryDropdownProps["value"],
): string | string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item).trim())
      .filter(Boolean);
    return normalized.length ? normalized : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function useCountryOptions() {
  const [options, setOptions] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    getNationalityList()
      .then((response) => {
        if (!active) {
          return;
        }

        const rows = Array.isArray(response)
          ? response
          : Array.isArray((response as { data?: unknown[] })?.data)
            ? ((response as { data: NationalityInfo[] }).data ?? [])
            : [];
        const mappedOptions = rows
          .map(mapNationalityToCountryOption)
          .filter((item): item is CountryOption => Boolean(item));
        const uniqueOptions = Array.from(
          new Map(mappedOptions.map((item) => [item.value, item])).values(),
        );
        setOptions(uniqueOptions);
      })
      .catch(() => {
        if (active) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { loading, options };
}

const CountryDropdownComponent: React.FC<CountryDropdownProps> = ({ value, onChange, ...props }) => {
  const field = useField();
  const form = useForm();
  const { loading, options } = useCountryOptions();
  const [searchValue, setSearchValue] = useState('');
  const { i18n, t } = useTranslation();
  const {
    placeholderEn,
    placeholderAr,
    titleEn,
    titleAr,
    placeholder,
    maxTagCount: configuredMaxTagCount,
    maxTagPlaceholder: configuredMaxTagPlaceholder,
    ...dropdownProps
  } = props;
  void titleEn;
  void titleAr;
  const resolvedPlaceholder =
    resolveCountryDropdownPlaceholder(
      { placeholderEn, placeholderAr, placeholder },
      i18n.language,
    ) ?? placeholder;
  const isPatternReadOnly =
    isNonEditablePattern(form.pattern) ||
    isNonEditablePattern(field.pattern);
  const isNonEditable =
    Boolean(dropdownProps.disabled) ||
    Boolean(dropdownProps.readOnly) ||
    isPatternReadOnly;
  const normalizedValue = useMemo(() => normalizeCountryDropdownValue(value), [value]);

  const localizedOptions = useMemo(
    () => {
      const text = searchValue.trim().toLowerCase();

      return options
        .map((option) => ({
          ...option,
          displayLabel: getLocalizedCountryLabel(option, i18n.language),
        }))
        .filter((option) => {
          if (!text) {
            return true;
          }

          return (
            option.displayLabel?.toLowerCase().includes(text) ||
            option.label.toLowerCase().includes(text) ||
            option.value.toLowerCase().includes(text) ||
            getCountryCode(option).toLowerCase().includes(text) ||
            option.nameAr?.toLowerCase().includes(text)
          );
        });
    },
    [i18n.language, options, searchValue],
  );

  const onSearch = (value: string) => {
    if (isNonEditable) return;
    setSearchValue(value);
  };

  const onChangeValue = (value: string | string[]) => {
    if (isNonEditable) return;
    if (onChange) {
      onChange(value);
    }
    setSearchValue('');
  };

  const getSelectedCountry = (
    countryValue: string | number,
  ): LocalizedCountryOption | undefined => {
    const country = options.find((item) => item.value === String(countryValue));
    if (!country) return undefined;
    return {
      ...country,
      displayLabel: getLocalizedCountryLabel(country, i18n.language),
    };
  };

  const tagRender: NonNullable<SelectProps<string>["tagRender"]> = (props) => {
    const { label, value: tagValue } = props;
    const selectedCountry = getSelectedCountry(tagValue);
    
    if (!selectedCountry) {
      return <span>{label}</span>;
    }

    return (
      <div className="country-dropdown-selected-tag">
        <img
          src={getFlagImage(getCountryCode(selectedCountry))}
          alt={selectedCountry.displayLabel}
          className="country-flag-image-selected"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = getFlagImage('_unknown');
          }}
        />
        <div className="country-dropdown-selected-label">
          <div className="country-dropdown-selected-label-text">
            {selectedCountry.displayLabel}
          </div>
          <div className="country-dropdown-selected-label-description">
            {t("CountryDropdown.countryCodeLabel")} {getCountryCode(selectedCountry)}
          </div>
        </div>
      </div>
    );
  };

  const isMultiple = dropdownProps.mode === 'multiple' || dropdownProps.mode === 'tags';
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple,
    isReadOnly: isPatternReadOnly,
    configuredMaxTagCount: configuredMaxTagCount as SelectProps<unknown>["maxTagCount"],
    configuredMaxTagPlaceholder: configuredMaxTagPlaceholder as SelectProps<unknown>["maxTagPlaceholder"],
  });
  
  return (
    <AntdSelect
      value={normalizedValue}
      onChange={isNonEditable ? undefined : onChangeValue}
      loading={loading}
      showSearch={!isNonEditable}
      filterOption={false}
      onSearch={isNonEditable ? undefined : onSearch}
      searchValue={isNonEditable ? undefined : searchValue}
      onDropdownVisibleChange={(open) => {
        if (!open) {
          setSearchValue('');
        }
      }}
      tagRender={isMultiple ? tagRender : undefined}
      {...dropdownProps}
      maxTagCount={readOnlyMultiSelectProps.maxTagCount}
      maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
      disabled={isNonEditable}
      open={
        isNonEditable
          ? false
          : typeof dropdownProps.open === "boolean"
            ? dropdownProps.open
            : undefined
      }
      placeholder={resolvedPlaceholder}
      notFoundContent={dropdownProps.notFoundContent ?? t("CountryDropdown.notFound")}
    >
      {localizedOptions.map((item) => (
        <AntdSelect.Option key={item.value} value={item.value} label={item.displayLabel}>
          <div className="country-dropdown-option">
            <img
              src={getFlagImage(getCountryCode(item))}
              alt={item.displayLabel}
              className="country-flag-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = getFlagImage('_unknown');
              }}
            />
            <div className="country-dropdown-option-label">
             <div className="country-dropdown-option-label-text">{item.displayLabel}</div>
             <div className="country-dropdown-option-label-description">
               {t("CountryDropdown.countryCodeLabel")} {getCountryCode(item)}
             </div>
            </div>
          </div>
        </AntdSelect.Option>
      ))}
    </AntdSelect>
  );
};

const CountryDropdownReadPretty: React.FC<CountryDropdownProps> = (props) => {
  const { i18n } = useTranslation();
  const { options } = useCountryOptions();
  const normalizedValue = normalizeCountryDropdownValue(props.value);
  const selectedValues = Array.isArray(normalizedValue)
    ? normalizedValue
    : [normalizedValue];
  const displayValue = selectedValues
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      const option = options.find((item) => item.value === value);
      return option
        ? getLocalizedCountryLabel(option, i18n.language)
        : value;
    })
    .join(", ");

  return <PreviewText.Input value={displayValue} />;
};

export const CountryDropdown = connect(
  CountryDropdownComponent,
  mapProps(
    {
      loading: true,
    },
    (props, field) => {
      const { options, dataSource, ...restProps } = props;
      void options;
      void dataSource;
      const fieldState = field as { loading?: boolean; validating?: boolean };
      return {
        ...restProps,
        suffixIcon:
          fieldState?.loading || fieldState?.validating ? (
            <LoadingOutlined />
          ) : (
            props.suffixIcon
          ),
      };
    }
  ),
  mapReadPretty((props) => {
    return <CountryDropdownReadPretty {...props} />;
  })
);

export default CountryDropdown;
