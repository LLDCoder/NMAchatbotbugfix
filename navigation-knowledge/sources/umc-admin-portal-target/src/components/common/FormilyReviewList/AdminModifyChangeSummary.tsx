import React, { useEffect, useMemo, useState } from "react";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";
import CustomButton from "@/components/common/CustomButton";
import DocumentViewer from "@/components/common/DocumentViewer";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import { AddSocialMediaModal } from "@/components/designable/src/components/SocialMediaAccount/AddSocialMediaModal";
import { SocialMediaAccountIcon } from "@/components/designable/src/components/SocialMediaAccount/SocialMediaAccountIcon";
import type { SocialMediaItem } from "@/components/designable/src/components/SocialMediaAccount/SocialMediaAccountField";
import {
  getAreaList,
  getEmirateList,
  getRegionList,
} from "@/services/address";
import { getLookupData } from "@/services/services";
import { getNationalityList } from "@/services/userProfile";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import { resolveExternalWebUrl } from "@/utils/externalWebUrl";
import {
  filterAdminModifyChangeSummaryForDisplay,
  formatChangeSummaryValue,
  type AdminModifyActivityChange,
  type AdminModifyChangeField,
  type AdminModifyChangeSection,
  type AdminModifyLanguageChange,
  type AdminModifyLanguageSnapshot,
  type AdminModifySocialChange,
  type AdminModifyChangeValueSource,
} from "./modifyChangeSummaryRules";
import "./AdminModifyChangeSummary.less";

interface AdminModifyChangeSummaryProps {
  sections: AdminModifyChangeSection[];
  serviceCode?: string | number | null;
}

type SummarySide = "before" | "after";
type ValueLabelMaps = Map<string, Map<string, string>>;

const DATE_FIELD_KEYS = new Set([
  "dateofbirth",
  "emiratesidexpirydate",
  "licenseexpirydate",
  "passportexpirydate",
  "tenancycontractenddate",
  "visaexpirydate",
]);

const isDateField = (field: AdminModifyChangeField) => {
  const fieldKey = field.key.split(".").at(-1) ?? field.key;
  return (
    field.component === "DatePicker" ||
    DATE_FIELD_KEYS.has(fieldKey.replace(/[^a-z0-9]/gi, "").toLowerCase())
  );
};

const PROFILE_FILE_FIELD_KEYS = new Set([
  "commercialLicense",
  "reserveTradeName",
  "tenancyContract",
  "memorandumOfAssociation",
  "powerOfAttorney",
]);

const SOCIAL_STATUS_LABEL_KEYS: Record<
  AdminModifySocialChange["changeType"],
  string
> = {
  added: "SocialMediaAccount.statusNew",
  modified: "SocialMediaAccount.statusModified",
  deleted: "SocialMediaAccount.statusDeleted",
};

const isFileField = (field: AdminModifyChangeField) =>
  field.component === "Upload" ||
  PROFILE_FILE_FIELD_KEYS.has(field.key.split(".").at(-1) ?? field.key);

const getValueSourceKey = (source: AdminModifyChangeValueSource) =>
  source.type === "lookup" ? `lookup:${source.source}` : source.type;

const getValueKey = (value: unknown) => String(value ?? "").trim();

const ChangeSummaryTableValue = ({ value }: { value: string }) => (
  <OverflowTooltip
    className="admin-modify-change-summary__table-cell"
    title={value}
  >
    {value}
  </OverflowTooltip>
);

const toValueLabelMap = (input: unknown, isArabic: boolean) =>
  new Map(
    normalizeLookupOptions(input, isArabic).map((option) => [
      getValueKey(option.value),
      option.label,
    ]),
  );

const SocialChangeCards: React.FC<{
  changes: AdminModifySocialChange[];
  sectionTitle: string;
  serviceCode?: string | number | null;
}> = ({ changes, sectionTitle, serviceCode }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const [selectedAccount, setSelectedAccount] = useState<SocialMediaItem | null>(
    null,
  );
  const [subCategories, setSubCategories] = useState<unknown[]>([]);
  const [accountTypes, setAccountTypes] = useState<unknown[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getLookupData("SocialMediaSubCategories", serviceCode),
      getLookupData("SocialMedias", serviceCode),
    ])
      .then(([subCategoryResponse, accountTypeResponse]) => {
        if (cancelled) return;
        setSubCategories(
          Array.isArray(subCategoryResponse?.data)
            ? subCategoryResponse.data
            : [],
        );
        setAccountTypes(
          Array.isArray(accountTypeResponse?.data) ? accountTypeResponse.data : [],
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSubCategories([]);
          setAccountTypes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCode]);

  const subCategoryLabels = useMemo(
    () =>
      new Map(
        normalizeLookupOptions(subCategories, isArabic).map((option) => [
          String(option.value),
          option.label,
        ]),
      ),
    [isArabic, subCategories],
  );
  const accountTypeNames = useMemo(
    () =>
      new Map(
        normalizeLookupOptions(accountTypes, false).map((option) => [
          String(option.value),
          option.label,
        ]),
      ),
    [accountTypes],
  );

  const renderAccountCard = (
    record: Record<string, unknown>,
    changeType?: AdminModifySocialChange["changeType"],
    key?: React.Key,
  ) => {
    const accountName = String(
      record.accountTitle ?? record.accountName ?? "",
    ).trim();
    const displayAccountName = accountName || t("SocialMediaAccount.untitled");
    const accountUrl = String(record.accountUrl ?? "").trim();
    const safeAccountUrl = resolveExternalWebUrl(accountUrl);
    const categories = Array.isArray(record.mediaSubCategories)
      ? record.mediaSubCategories
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
    const visibleCategories = categories.slice(0, 3);
    const hiddenCategories = categories.slice(3);

    return (
      <article
        key={key}
        className={`admin-modify-change-summary__social-card${
          changeType
            ? ` admin-modify-change-summary__social-card--${changeType}`
            : ""
        }`}
      >
        <header className="admin-modify-change-summary__social-card-header">
          <SocialMediaAccountIcon
            className="admin-modify-change-summary__social-icon"
            nameEn={accountTypeNames.get(String(record.accountType ?? ""))}
          />
          <div className="admin-modify-change-summary__social-info">
            <div className="admin-modify-change-summary__social-name-row">
              <OverflowTooltip
                className="admin-modify-change-summary__social-name"
                title={displayAccountName}
              >
                {displayAccountName}
              </OverflowTooltip>
              {changeType ? (
                <span
                  className={`admin-modify-change-summary__social-status admin-modify-change-summary__social-status--${changeType}`}
                >
                  {t(SOCIAL_STATUS_LABEL_KEYS[changeType])}
                </span>
              ) : null}
            </div>
            {safeAccountUrl ? (
              <a
                className="admin-modify-change-summary__social-url admin-modify-change-summary__social-url--link"
                href={safeAccountUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={accountUrl}
                onClick={(event) => event.stopPropagation()}
              >
                {accountUrl}
              </a>
            ) : (
              <div className="admin-modify-change-summary__social-url">
                {accountUrl || t("SocialMediaAccount.noUrl")}
              </div>
            )}
          </div>
        </header>

        {categories.length > 0 ? (
          <div className="admin-modify-change-summary__social-categories">
            <span className="admin-modify-change-summary__social-category-label">
              {t("SocialMediaAccount.subCategory")}
            </span>
            <div className="admin-modify-change-summary__social-category-list">
              {visibleCategories.map((category) => (
                <Tag
                  className="admin-modify-change-summary__social-category"
                  key={category}
                >
                  {subCategoryLabels.get(category) ?? category}
                </Tag>
              ))}
              {hiddenCategories.length > 0 ? (
                <Tag className="admin-modify-change-summary__social-category admin-modify-change-summary__social-category--more">
                  +{hiddenCategories.length}
                </Tag>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="admin-modify-change-summary__social-actions">
          <CustomButton
            size="small"
            customClassName="admin-modify-change-summary__social-details"
            onClick={() => setSelectedAccount(record as SocialMediaItem)}
          >
            {t("SocialMediaAccount.details")}
          </CustomButton>
        </div>
      </article>
    );
  };

  const beforeAccounts = changes.map((change, index) => ({
    change,
    key: `before-${change.key}-${index}`,
  }));
  const afterAccounts = changes.map((change, index) => ({
    change,
    key: `after-${change.key}-${index}`,
  }));

  return (
    <div className="admin-modify-change-summary__social-section">
      <div className="admin-modify-change-summary__social-comparisons">
        <div className="admin-modify-change-summary__section admin-modify-change-summary__social-comparison">
          <article className="admin-modify-change-summary__card admin-modify-change-summary__social-comparison-card">
            <header className="admin-modify-change-summary__card-header">
              <h3 className="admin-modify-change-summary__section-title">
                {sectionTitle}
              </h3>
              <span className="admin-modify-change-summary__status admin-modify-change-summary__status--before">
                {t("FormilyReviewList.changeSummary.before")}
              </span>
            </header>
            {beforeAccounts.length > 0 ? (
              <div className="admin-modify-change-summary__social-card-list">
                {beforeAccounts.map(({ change, key }) =>
                  change.before ? (
                    renderAccountCard(
                      change.before,
                      change.changeType === "deleted" ? "deleted" : undefined,
                      key,
                    )
                  ) : (
                    <span
                      className="admin-modify-change-summary__social-placeholder"
                      key={key}
                    >
                      -
                    </span>
                  ),
                )}
              </div>
            ) : (
              <span className="admin-modify-change-summary__social-placeholder">
                -
              </span>
            )}
          </article>

          <article className="admin-modify-change-summary__card admin-modify-change-summary__social-comparison-card">
            <header className="admin-modify-change-summary__card-header">
              <h3 className="admin-modify-change-summary__section-title">
                {t("FormilyReviewList.changeSummary.sectionChanges", {
                  section: sectionTitle,
                })}
              </h3>
              <span className="admin-modify-change-summary__status admin-modify-change-summary__status--after">
                {t("FormilyReviewList.changeSummary.after")}
              </span>
            </header>
            {afterAccounts.length > 0 ? (
              <div className="admin-modify-change-summary__social-card-list">
                {afterAccounts.map(({ change, key }) =>
                  change.after ? (
                    renderAccountCard(
                      change.after,
                      change.changeType === "added" ||
                        change.changeType === "modified"
                        ? change.changeType
                        : undefined,
                      key,
                    )
                  ) : (
                    <span
                      className="admin-modify-change-summary__social-placeholder"
                      key={key}
                    >
                      -
                    </span>
                  ),
                )}
              </div>
            ) : (
              <span className="admin-modify-change-summary__social-placeholder">
                -
              </span>
            )}
          </article>
        </div>
      </div>
      <AddSocialMediaModal
        visible={selectedAccount !== null}
        mode="view"
        editingItem={selectedAccount}
        onSave={() => undefined}
        onCancel={() => setSelectedAccount(null)}
      />
    </div>
  );
};

const AdminModifyChangeSummary: React.FC<AdminModifyChangeSummaryProps> = ({
  sections,
  serviceCode,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const displaySections = useMemo(
    () => filterAdminModifyChangeSummaryForDisplay(sections, serviceCode),
    [sections, serviceCode],
  );
  const valueSources = useMemo(() => {
    const sources = new Map<string, AdminModifyChangeValueSource>();
    displaySections.forEach((section) => {
      section.fields.forEach((field) => {
        if (!field.valueSource) return;
        sources.set(getValueSourceKey(field.valueSource), field.valueSource);
      });
    });
    return sources;
  }, [displaySections]);
  const [valueLabelMaps, setValueLabelMaps] = useState<ValueLabelMaps>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    if (valueSources.size === 0) {
      setValueLabelMaps(new Map());
      return () => {
        cancelled = true;
      };
    }

    const loadSource = async (
      source: AdminModifyChangeValueSource,
    ): Promise<[string, Map<string, string>]> => {
      const sourceKey = getValueSourceKey(source);
      try {
        if (source.type === "lookup") {
          const response = await getLookupData(source.source, serviceCode);
          return [sourceKey, toValueLabelMap(response?.data, isArabic)];
        }
        if (source.type === "nationality") {
          const response = await getNationalityList();
          return [sourceKey, toValueLabelMap(response?.data, isArabic)];
        }
        if (source.type === "emirate") {
          const response = await getEmirateList(serviceCode);
          return [sourceKey, toValueLabelMap(response?.data, isArabic)];
        }
        if (source.type === "region") {
          const response = await getRegionList();
          return [sourceKey, toValueLabelMap(response?.data, isArabic)];
        }
        const response = await getAreaList();
        return [sourceKey, toValueLabelMap(response?.data, isArabic)];
      } catch {
        return [sourceKey, new Map()];
      }
    };

    Promise.all(Array.from(valueSources.values()).map(loadSource)).then(
      (entries) => {
        if (!cancelled) setValueLabelMaps(new Map(entries));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isArabic, serviceCode, valueSources]);

  if (displaySections.length === 0) return null;
  const detailSections = displaySections.filter(
    (section) =>
      section.fields.length > 0 ||
      section.languageChanges.length > 0 ||
      (section.activityChanges?.length ?? 0) > 0 ||
      section.socialChanges.length > 0,
  );

  const getSectionTitle = (section: AdminModifyChangeSection) =>
    isArabic ? section.titleAr : section.titleEn;

  const renderValue = (field: AdminModifyChangeField, side: SummarySide) => {
    const value = side === "before" ? field.before : field.after;
    if (isFileField(field) && typeof value === "string" && value.trim()) {
      return <DocumentViewer fileName={value} fileUrl={value} hasView />;
    }

    const valueKey = getValueKey(value);
    if (valueKey && field.valueSource) {
      const remoteLabel = valueLabelMaps
        .get(getValueSourceKey(field.valueSource))
        ?.get(valueKey);
      if (remoteLabel) return remoteLabel;
    }
    const localOption = field.valueOptions?.find(
      (option) => getValueKey(option.value) === valueKey,
    );
    if (localOption) {
      return isArabic ? localOption.labelAr : localOption.labelEn;
    }
    if (typeof value === "boolean") {
      return t(
        value
          ? "FormilyReviewList.changeSummary.yes"
          : "FormilyReviewList.changeSummary.no",
      );
    }
    return formatChangeSummaryValue(value, { dateOnly: isDateField(field) });
  };

  const renderFieldLabel = (
    field: AdminModifyChangeSection["fields"][number],
  ) =>
    field.labelI18nKey
      ? t(field.labelI18nKey)
      : isArabic
        ? field.labelAr
        : field.labelEn;

  const renderLanguageBefore = (changes: AdminModifyLanguageChange[]) => (
    <table className="admin-modify-change-summary__table">
      <thead>
        <tr>
          <th>{t("FormilyReviewList.changeSummary.language")}</th>
          <th>{t("FormilyReviewList.changeSummary.name")}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr key={`before-${change.key}`}>
            <td>
              <ChangeSummaryTableValue value={change.before?.language || "-"} />
            </td>
            <td>
              <ChangeSummaryTableValue value={change.before?.name || "-"} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderLanguageAfter = (changes: AdminModifyLanguageChange[]) => (
    <table className="admin-modify-change-summary__table">
      <thead>
        <tr>
          <th>{t("FormilyReviewList.changeSummary.changeType")}</th>
          <th>{t("FormilyReviewList.changeSummary.language")}</th>
          <th>{t("FormilyReviewList.changeSummary.name")}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr key={`after-${change.key}`}>
            <td>
              <ChangeSummaryTableValue
                value={t(`FormilyReviewList.changeSummary.${change.changeType}`)}
              />
            </td>
            <td>
              <ChangeSummaryTableValue value={change.after?.language || "-"} />
            </td>
            <td>
              <ChangeSummaryTableValue value={change.after?.name || "-"} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderLanguageSnapshot = (
    snapshot: AdminModifyLanguageSnapshot,
    side: SummarySide,
  ) => {
    const rows = side === "before"
      ? snapshot.beforeRows
      : [...snapshot.afterRows, ...snapshot.deletedRows];
    return (
      <table
        className="admin-modify-change-summary__table"
        key={`${side}-${snapshot.key}`}
      >
        <thead>
          <tr>
            {side === "after" ? (
              <th>{t("FormilyReviewList.changeSummary.changeType")}</th>
            ) : null}
            <th>{t("FormilyReviewList.changeSummary.language")}</th>
            <th>{t("FormilyReviewList.changeSummary.name")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={`${side}-${snapshot.key}-${index}`}>
                {side === "after" ? (
                  <td>
                    <ChangeSummaryTableValue
                      value={
                        "changeType" in row && row.changeType
                          ? t(
                              `FormilyReviewList.changeSummary.${row.changeType}`,
                            )
                          : "-"
                      }
                    />
                  </td>
                ) : null}
                <td>
                  <ChangeSummaryTableValue value={row.language || "-"} />
                </td>
                <td>
                  <ChangeSummaryTableValue value={row.name || "-"} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={side === "after" ? 3 : 2}>
                {t("FormilyReviewList.changeSummary.noLanguageRecords")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  const renderActivityChanges = (
    changes: AdminModifyActivityChange[],
    sectionTitle: string,
  ) => (
    <article className="admin-modify-change-summary__card admin-modify-change-summary__activity-card">
      <header className="admin-modify-change-summary__card-header">
        <h3 className="admin-modify-change-summary__section-title">
          {t("FormilyReviewList.changeSummary.sectionChanges", {
            section: sectionTitle,
          })}
        </h3>
      </header>
      <table className="admin-modify-change-summary__table">
        <thead>
          <tr>
            <th>{t("FormilyReviewList.changeSummary.changeType")}</th>
            <th>{t("FormilyReviewList.changeSummary.activity")}</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.key}>
              <td>
                {t(`FormilyReviewList.changeSummary.${change.changeType}`)}
              </td>
              <td>{formatChangeSummaryValue(change.after ?? change.before)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );

  return (
    <section className="admin-modify-change-summary">
      <h2 className="admin-modify-change-summary__title">
        {t("FormilyReviewList.changeSummary.title")}
      </h2>

      <div className="admin-modify-change-summary__sections">
        {detailSections.map((section) => {
          const sectionTitle = getSectionTitle(section);
          const hasComparisonChanges =
            section.fields.length > 0 ||
            section.languageChanges.length > 0 ||
            Boolean(section.languageSnapshots?.length);
          return (
            <div
              className="admin-modify-change-summary__section-group"
              key={section.key}
            >
              {hasComparisonChanges ? (
                <div className="admin-modify-change-summary__section">
                  <article className="admin-modify-change-summary__card admin-modify-change-summary__before-card">
                    <header className="admin-modify-change-summary__card-header">
                      <h3 className="admin-modify-change-summary__section-title">
                        {sectionTitle}
                      </h3>
                      <span className="admin-modify-change-summary__status admin-modify-change-summary__status--before">
                        {t("FormilyReviewList.changeSummary.before")}
                      </span>
                    </header>
                    <div className="admin-modify-change-summary__fields">
                      {section.fields.map((field) => (
                        <div
                          className="admin-modify-change-summary__field"
                          key={`before-${field.key}`}
                        >
                          <span className="admin-modify-change-summary__label">
                            {renderFieldLabel(field)}
                          </span>
                          <div className="admin-modify-change-summary__value">
                            {renderValue(field, "before")}
                          </div>
                        </div>
                      ))}
                    </div>
                    {section.languageSnapshots?.length
                      ? section.languageSnapshots.map((snapshot) =>
                          renderLanguageSnapshot(snapshot, "before"),
                        )
                      : section.languageChanges.length > 0
                        ? renderLanguageBefore(section.languageChanges)
                        : null}
                  </article>

                  <article className="admin-modify-change-summary__card admin-modify-change-summary__after-card">
                    <header className="admin-modify-change-summary__card-header">
                      <h3 className="admin-modify-change-summary__section-title">
                        {t("FormilyReviewList.changeSummary.sectionChanges", {
                          section: sectionTitle,
                        })}
                      </h3>
                      <span className="admin-modify-change-summary__status admin-modify-change-summary__status--after">
                        {t("FormilyReviewList.changeSummary.after")}
                      </span>
                    </header>
                    <div className="admin-modify-change-summary__fields">
                      {section.fields.map((field) => (
                        <div
                          className="admin-modify-change-summary__field"
                          key={`after-${field.key}`}
                        >
                          <span className="admin-modify-change-summary__label">
                            {renderFieldLabel(field)}
                          </span>
                          <div className="admin-modify-change-summary__value">
                            {renderValue(field, "after")}
                          </div>
                        </div>
                      ))}
                    </div>
                    {section.languageSnapshots?.length
                      ? section.languageSnapshots.map((snapshot) =>
                          renderLanguageSnapshot(snapshot, "after"),
                        )
                      : section.languageChanges.length > 0
                        ? renderLanguageAfter(section.languageChanges)
                        : null}
                  </article>
                </div>
              ) : null}
              {section.activityChanges?.length
                ? renderActivityChanges(section.activityChanges, sectionTitle)
                : null}
              {section.socialChanges.length > 0 ? (
                <SocialChangeCards
                  changes={section.socialChanges}
                  sectionTitle={sectionTitle}
                  serviceCode={serviceCode}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AdminModifyChangeSummary;
