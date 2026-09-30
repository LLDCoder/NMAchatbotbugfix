// import "antd/dist/antd.less";
import "./main.less";
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useLayoutEffect,
  isValidElement,
} from "react";
import type { ReactNode } from "react";
import Step from "./step";
import { useLocation } from "react-router-dom";
import { Tabs, ConfigProvider } from "antd";
import { getAntdLocale } from "@/utils/antdLocale";
import SimpleBar from "@/components/SimpleBar";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import {
  FormLanguageProvider,
  getStoredDesignerContentLang,
  type PortalFormLang,
} from "./FormPreviewLangContext";
import { useTranslation } from "react-i18next";
import {
  Designer,
  DesignerToolsWidget,
  ViewToolsWidget,
  Workspace,
  ResourceWidget,
  StudioPanel,
  CompositePanel,
  WorkspacePanel,
  ToolbarPanel,
  ViewportPanel,
  SettingsPanel,
  ComponentTreeWidget,
  IconWidget,
  TextWidget,
  AuxToolWidget,
  EmptyWidget,
  useViewport,
} from "@designable/react";
import { globalThisPolyfill, requestIdle } from "@designable/shared";
import {
  SettingsForm,
  setNpmCDNRegistry,
} from "@designable/react-settings-form";

import OptionsEditor from "../src/components/SelectTable/OptionsEditor";
import StyleSelector from "../src/components/Information/StyleSelector";
import DividerStyleSetter from "../src/components/Divider/DividerStyleSetter";
import DataSourceSetter from "../src/components/EquipmentList/Setter/DataSource";
import SingleSelectOptionsSetter from "../src/components/SingleSelectOptionsSetter";
import SelectOptionsSetter from "../src/components/SelectOptionsSetter";
import MultiSelectOptionsSetter from "../src/components/MultiSelectOptionsSetter";
import FieldWidthSetter from "../src/components/FieldWidthSetter";
import StringSwitchSetter from "../src/components/StringSwitchSetter";
import { ValidatorSetter } from "@designable/formily-setters";
import ActivityConfigurationSetter from "../src/components/SelectTable/Setter/ActivityConfigurationSetter";
import VideoUploadSetter from "../src/components/Video/Setter/VideoUploadSetter";
import UniqueValueSetter from "../src/components/UniqueValueSetter";
import OptionsSourceSetter from "../src/components/OptionsSourceSetter";
import DescriptionRichTextSetter from "../src/components/DescriptionRichTextSetter";
import WordLimitSetter from "../src/components/WordLimitSetter";
import RestrictionSetter from "../src/components/RestrictionSetter";
import DataListSourceSetter from "../src/components/DataList/Setter/DataListSourceSetter";
import {
  createDesigner,
  GlobalRegistry,
  Shortcut,
  KeyCode,
  UpdateNodePropsEvent,
  RemoveNodeEvent,
  WrapNodeEvent,
  CloneNodeEvent,
  DropNodeEvent,
} from "@designable/core";
import type { IResource } from "@designable/core";
import { saveSchema } from "./service";
import {
  Form,
  Field,
  Input,
  DurationInput,
  Select,
  MultiDropdown,
  SelectTable,
  CountryDropdown,
  EmiratePort,
  Address,
  AddressPicker,
  DataList,
  BeneficiaryType,
  TreeSelect,
  Cascader,
  Radio,
  RadioGroupField,
  Checkbox,
  Slider,
  Rate,
  NumberPicker,
  Transfer,
  Password,
  DatePicker,
  TimePicker,
  Upload,
  Switch,
  Text,
  Card,
  ArrayCards,
  ObjectContainer,
  ArrayTable,
  Space,
  FormTab,
  FormCollapse,
  FormLayout,
  FormGrid,
  Information,
  Divider,
  RichText,
  LanguageSelect,
  LanguageSelectMulti,
  IDSelector,
  AcquaintanceForm,
  AddressList,
  DataForm,
  BookList,
  FileUploadGrid,
  SelectTableSingle,
  PublicationForm,
  BookTradingForm,
  FilmingTeam,
  SocialMediaAccount,
  PersonsInChargeList,
  PartnerList,
  GameDistributionForm,
  VideoGamePackageForm,
  MoviePackageForm,
  FilmingPurposeForm,
  FilmRescreeningForm,
  FilmScreeningForm,
  FilmTrailerForm,
  ProfileForm,
  LicenseTransferForm,
  LicenseInformationForm,
  TradeLicenseDetails,
  GuardianConsentDetails,
  NewpaperMagazineCirculation,
  TransferInformation,
  Video,
  TransferHistory,
  ScriptPublicationForm,
  UrlList,
  PressCardSelector,
  MultiFile,
  DraftFileOrLink,
} from "../src";
import { SocialMediaManager } from "../src/components/SocialMediaManager";
import { PosterAndTrailerPermit } from "../src/components/PosterAndTrailerPermit";
import {
  MobileNumberInput,
  MobileNumberRuntimeProvider,
} from "../src/components/MobileNumberInput";
import { transformToTreeNode } from "@designable/formily-transformer";
import { registerValidatorLocales } from "./registerValidatorLocales";

const DESIGNABLE_LOCAL_NPM_REGISTRY = "/assets/vendor/npm";
const DESIGNER_MOBILE_NUMBER_RUNTIME_CONFIG = {
  defaultCountryCode: "",
};

const renderResourceItem = (
  resource: IResource,
  options?: { readOnly?: boolean },
) => {
  const { node, icon, thumb, span } = resource;

  if (!node) return <></>;

  const title = resource.title || node.children[0]?.getMessage("title");

  return (
    <div
      className="dn-resource-item"
      style={{ gridColumnStart: `span ${span || 1}` }}
      key={node.id}
      data-designer-source-id={options?.readOnly ? undefined : node.id}
      aria-disabled={options?.readOnly}
    >
      {thumb && (
        <img className="dn-resource-item-thumb" src={thumb} alt="" />
      )}
      {icon && isValidElement(icon) ? (
        <>{icon}</>
      ) : (
        <IconWidget
          className="dn-resource-item-icon"
          infer={icon}
          style={{ width: 20, height: 20 }}
        />
      )}
      <OverflowTooltip
        className="dn-resource-item-text"
        title={<TextWidget>{title}</TextWidget>}
      >
        <TextWidget>{title}</TextWidget>
      </OverflowTooltip>
    </div>
  );
};

setNpmCDNRegistry(DESIGNABLE_LOCAL_NPM_REGISTRY);

registerValidatorLocales();
interface PlaygroundProps {
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  usePageScroll?: boolean;
}

interface PlaygroundStepRef {
  saveForm: () => Promise<unknown>;
}

interface DesignableCanvasViewportProps {
  children: ReactNode;
  usePageScroll: boolean;
}

const DesignableCanvasViewport = ({
  children,
  usePageScroll,
}: DesignableCanvasViewportProps) => {
  const viewport = useViewport();
  const viewportElementRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const viewportElement = viewportElementRef.current;
    if (!viewport || !viewportElement) {
      return;
    }

    let active = true;
    viewport.onMount(viewportElement, globalThisPolyfill);
    requestIdle(() => {
      if (active) {
        setLoaded(true);
      }
    });

    return () => {
      active = false;
      viewport.onUnmount();
    };
  }, [usePageScroll, viewport]);

  if (usePageScroll) {
    return (
      <div
        ref={viewportElementRef}
        className="dn-viewport designable-canvas-viewport designable-canvas-viewport--page-scroll"
        style={{ opacity: loaded ? 1 : 0 }}
      >
        <div className="designable-canvas-viewport__content">{children}</div>
        <AuxToolWidget />
        <EmptyWidget />
      </div>
    );
  }

  return (
    <SimpleBar className="designable-canvas-scroll" autoHide>
      {({
        scrollableNodeRef,
        scrollableNodeProps,
        contentNodeRef,
        contentNodeProps,
      }) => (
        <div
          {...scrollableNodeProps}
          ref={(node) => {
            scrollableNodeRef.current = node ?? undefined;
            viewportElementRef.current = node;
          }}
          className={`${scrollableNodeProps.className} dn-viewport designable-canvas-scroll__viewport`}
          style={{ opacity: loaded ? 1 : 0 }}
        >
          <div
            ref={(node) => {
              contentNodeRef.current = node ?? undefined;
            }}
            className={`${contentNodeProps.className} designable-canvas-scroll__content`}
          >
            {children}
          </div>
          <AuxToolWidget />
          <EmptyWidget />
        </div>
      )}
    </SimpleBar>
  );
};

const Playground = forwardRef((props: PlaygroundProps, ref) => {
  const { onDirtyChange, readOnly = false, usePageScroll = false } = props;
  const stepRef = useRef<PlaygroundStepRef>(null);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const uiLang: PortalFormLang = i18n.resolvedLanguage === "ar" ? "ar" : "en";
  const designerUiLanguage = uiLang === "ar" ? "ar-ae" : "en-us";
  const uiDirection = uiLang === "ar" ? "rtl" : "ltr";
  const uiLocale = getAntdLocale(uiLang);
  const [contentLang, setDesignerContentLang] = useState<PortalFormLang>(
    () => getStoredDesignerContentLang(),
  );
  const suppressDirtyTrackingRef = useRef(false);
  const suppressDirtyTrackingTimerRef = useRef<number | null>(null);
  const dirtyNotificationTimerRef = useRef<number | null>(null);
  const contentDirection = contentLang === "ar" ? "rtl" : "ltr";
  const contentLocale = getAntdLocale(contentLang);

  if (GlobalRegistry.getDesignerLanguage() !== designerUiLanguage) {
    GlobalRegistry.setDesignerLanguage(designerUiLanguage);
    registerValidatorLocales();
  }
  const engine = useMemo(
    () =>
      createDesigner({
        shortcuts: [
          new Shortcut({
            codes: [
              [KeyCode.Meta, KeyCode.S],
              [KeyCode.Control, KeyCode.S],
            ],
            handler(ctx) {
              saveSchema(ctx.engine);
            },
          }),
        ],
        rootComponentName: "Form",
      }),
    [],
  );
  const suppressDirtyTracking = useCallback(() => {
    suppressDirtyTrackingRef.current = true;
    if (suppressDirtyTrackingTimerRef.current !== null) {
      window.clearTimeout(suppressDirtyTrackingTimerRef.current);
    }
    suppressDirtyTrackingTimerRef.current = window.setTimeout(() => {
      suppressDirtyTrackingRef.current = false;
      suppressDirtyTrackingTimerRef.current = null;
    }, 0);
  }, []);
  const claer = useCallback(() => {
    suppressDirtyTracking();
    const emptySchema = {
      componentName: "Form",
      props: {},
      children: [],
    };
    engine.setCurrentTree(transformToTreeNode(emptySchema));
  }, [engine, suppressDirtyTracking]);
  useImperativeHandle(ref, () => ({
    save: async () => {
      return await stepRef.current?.saveForm();
    },
  }));

  useEffect(() => {
    claer();
  }, [claer, location.pathname]);

  useEffect(() => {
    const markDirty = () => {
      if (suppressDirtyTrackingRef.current) {
        return;
      }

      if (dirtyNotificationTimerRef.current === null) {
        dirtyNotificationTimerRef.current = window.setTimeout(() => {
          dirtyNotificationTimerRef.current = null;
          onDirtyChange?.(true);
        }, 0);
      }
    };

    const unsubscribers = [
      engine.subscribeTo(UpdateNodePropsEvent, markDirty),
      engine.subscribeTo(RemoveNodeEvent, markDirty),
      engine.subscribeTo(WrapNodeEvent, markDirty),
      engine.subscribeTo(CloneNodeEvent, markDirty),
      engine.subscribeTo(DropNodeEvent, markDirty),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      });
      if (suppressDirtyTrackingTimerRef.current !== null) {
        window.clearTimeout(suppressDirtyTrackingTimerRef.current);
        suppressDirtyTrackingTimerRef.current = null;
      }
      if (dirtyNotificationTimerRef.current !== null) {
        window.clearTimeout(dirtyNotificationTimerRef.current);
        dirtyNotificationTimerRef.current = null;
      }
    };
  }, [engine, onDirtyChange]);

  return (
    <FormLanguageProvider
      uiLang={uiLang}
      contentLang={contentLang}
      host="designer"
      setDesignerContentLang={setDesignerContentLang}
    >
      <MobileNumberRuntimeProvider
        config={DESIGNER_MOBILE_NUMBER_RUNTIME_CONFIG}
      >
        <ConfigProvider
          direction={uiDirection}
          locale={uiLocale}
        >
          <Designer engine={engine}>
          <StudioPanel
            className={`form-designer ${
              readOnly ? "form-designer--readonly" : ""
            }`}
          >
            <CompositePanel>
              <CompositePanel.Item title={t("Main.compositePanelTitle")} icon="Component">
                <Tabs defaultActiveKey="1" className="freeTab">
                  <Tabs.TabPane tab={t("Main.tabBasic")} key="1">
                    <SimpleBar
                      className="designable-resource-scroll"
                      autoHide
                    >
                      <ResourceWidget
                        title=""
                        sources={[
                          Card,
                          Input,
                          MobileNumberInput,
                          DurationInput,
                          Radio,
                          Checkbox,
                          Select,
                          MultiDropdown,
                          DatePicker,
                          Upload,
                          MultiFile,
                          LanguageSelect,
                          LanguageSelectMulti,
                          CountryDropdown,
                          AddressPicker,
                          Information,
                          Divider,
                          Video,
                          EmiratePort,
                          FormGrid,

                          // Password,
                          NumberPicker,
                          // Rate,
                          // Slider,
                          // TreeSelect,
                          // Cascader,
                          // Transfer,
                          // TimePicker,
                          // Switch,
                          // ObjectContainer,
                          // FormTab,
                          // FormLayout,
                          // FormCollapse,
                          // Space,

                          // ArrayCards,
                          // ArrayTable,
                          // AddressList,
                          // UrlList,
                        ]}
                      >
                        {(resource) =>
                          renderResourceItem(resource, { readOnly })
                        }
                      </ResourceWidget>
                    </SimpleBar>
                  </Tabs.TabPane>
                  <Tabs.TabPane tab={t("Main.tabAdvanced")} key="2">
                    <SimpleBar
                      className="designable-resource-scroll"
                      autoHide
                    >
                      <ResourceWidget
                        title="sources.Inputs"
                        sources={[
                          SelectTable,
                          SelectTableSingle,
                          DataList,
                          BeneficiaryType,
                          IDSelector,
                          DataForm,
                          BookList,
                          FileUploadGrid,
                          PublicationForm,
                          BookTradingForm,
                          FilmingTeam,
                          PersonsInChargeList,
                          SocialMediaAccount,
                          PartnerList,
                          GameDistributionForm,
                          VideoGamePackageForm,
                          MoviePackageForm,
                          FilmingPurposeForm,
                          FilmRescreeningForm,
                          FilmScreeningForm,
                          FilmTrailerForm,
                          ProfileForm,
                          LicenseTransferForm,
                          LicenseInformationForm,
                          TradeLicenseDetails,
                          GuardianConsentDetails,
                          NewpaperMagazineCirculation,
                          TransferInformation,
                          TransferHistory,
                          ScriptPublicationForm,
                          AddressList,
                          AcquaintanceForm,
                          UrlList,
                          DraftFileOrLink,
                          PosterAndTrailerPermit,
                          PressCardSelector,
                          SocialMediaManager,
                        ]}
                      >
                        {(resource) =>
                          renderResourceItem(resource, { readOnly })
                        }
                      </ResourceWidget>
                    </SimpleBar>
                  </Tabs.TabPane>
                </Tabs>

                {/* <ResourceWidget title="sources.Displays" sources={[Text]} /> */}
              </CompositePanel.Item>

              {/* <CompositePanel.Item title="panels.OutlinedTree" icon="Outline">
            <OutlineTreeWidget />
          </CompositePanel.Item>
          <CompositePanel.Item title="panels.History" icon="History">
            <HistoryWidget />
          </CompositePanel.Item> */}
            </CompositePanel>
            <div className="form-designer__main">
              <div
                className={`workspace ${
                  usePageScroll ? "designable-workspace--page-scroll" : ""
                }`}
                style={{
                  flex: 1,
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Step
                  callParent={claer}
                  ref={stepRef}
                  contentLang={contentLang}
                  setDesignerContentLang={setDesignerContentLang}
                  onBeforeSchemaLoad={suppressDirtyTracking}
                  onDirtyChange={onDirtyChange}
                  readOnly={readOnly}
                />
                <Workspace id="form">
                  <WorkspacePanel>
                    <ToolbarPanel>
                      <DesignerToolsWidget />
                      <ViewToolsWidget use={["DESIGNABLE"]} />
                    </ToolbarPanel>
                    <ViewportPanel
                      style={usePageScroll ? undefined : { height: "100%" }}
                    >
                      <DesignableCanvasViewport usePageScroll={usePageScroll}>
                        <ConfigProvider
                          direction={contentDirection}
                          locale={contentLocale}
                        >
                          <div
                            className="designable-canvas-preview"
                            dir={contentDirection}
                          >
                            <ComponentTreeWidget
                              components={{
                                Form,
                                Field,
                                Input,
                                DurationInput,
                                Select,
                                MultiDropdown,
                                LanguageSelect,
                                LanguageSelectMulti,
                                IDSelector,
                                AcquaintanceForm,
                                DataForm,
                                BookList,
                                FileUploadGrid,
                                SelectTable,
                                SelectTableSingle,
                                CountryDropdown,
                                EmiratePort,
                                Address,
                                AddressPicker,
                                DataList,
                                BeneficiaryType,
                                Information,
                                Divider,
                                RichText,
                                AddressList,
                                PublicationForm,
                                BookTradingForm,
                                FilmingTeam,
                                PersonsInChargeList,
                                TreeSelect,
                                Cascader,
                                Radio,
                                "Radio.Group": RadioGroupField,
                                Checkbox,
                                Slider,
                                Rate,
                                NumberPicker,
                                Transfer,
                                Password,
                                DatePicker,
                                TimePicker,
                                Upload,
                                MultiFile,
                                DraftFileOrLink,
                                Switch,
                                Text,
                                Card,
                                ArrayCards,
                                ArrayTable,
                                Space,
                                FormTab,
                                FormCollapse,
                                FormGrid,
                                FormLayout,
                                ObjectContainer,
                                SocialMediaAccount,
                                PartnerList,
                                GameDistributionForm,
                                VideoGamePackageForm,
                                MoviePackageForm,
                                FilmingPurposeForm,
                                FilmRescreeningForm,
                                FilmScreeningForm,
                                FilmTrailerForm,
                                ProfileForm,
                                LicenseTransferForm,
                                LicenseInformationForm,
                                TradeLicenseDetails,
                                GuardianConsentDetails,
                                NewpaperMagazineCirculation,
                                TransferInformation,
                                Video,
                                TransferHistory,
                                ScriptPublicationForm,
                                UrlList,
                                SocialMediaManager,
                                PressCardSelector,
                                PosterAndTrailerPermit,
                                MobileNumberInput,
                              }}
                            />
                          </div>
                        </ConfigProvider>
                      </DesignableCanvasViewport>
                    </ViewportPanel>
                  </WorkspacePanel>
                </Workspace>
              </div>
              <SettingsPanel title={t("Main.settingsPanelTitle")}>
                <SettingsForm
                  key={uiLang}
                  uploadAction="/api/Document/Upload"
                  className="SettingsFormWorkspace"
                  components={{
                    OptionsEditor,
                    RichText,
                    StyleSelector,
                    DividerStyleSetter,
                    DataSourceSetter,
                    SingleSelectOptionsSetter,
                    MultiSelectOptionsSetter,
                    SelectOptionsSetter,
                    FieldWidthSetter,
                    StringSwitchSetter,
                    ValidatorSetter,
                    ActivityConfigurationSetter,
                    VideoUploadSetter,
                    UniqueValueSetter,
                    OptionsSourceSetter,
                    DescriptionRichTextSetter,
                    WordLimitSetter,
                    RestrictionSetter,
                    DataListSourceSetter,
                  }}
                />
              </SettingsPanel>
            </div>
          </StudioPanel>
        </Designer>
        </ConfigProvider>
      </MobileNumberRuntimeProvider>
    </FormLanguageProvider>
  );
});

export default Playground;
