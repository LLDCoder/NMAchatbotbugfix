const COUNTRY_FLAG_IMAGES = import.meta.glob(
  "./assets/icon/*.svg",
  {
    eager: true,
    import: "default",
    query: "?url&no-inline",
  },
) as Record<string, string>;
export const CountryFlag = ({
  countryCode,
  className = "",
}: {
  countryCode?: string;
  className?: string;
}) => {
  const countrySource =
    COUNTRY_FLAG_IMAGES[
      `./assets/icon/${countryCode || "UNKNOWN"}.svg`
    ];
  const source =
    countrySource || COUNTRY_FLAG_IMAGES["./assets/icon/Flag-default.svg"];
  return (
    <span
      aria-hidden="true"
      className={`country-select__flag${countrySource ? "" : " country-select__flag--placeholder"}${className ? ` ${className}` : ""}`}
    >
      <img alt="" loading="lazy" src={source} />
    </span>
  );
};
