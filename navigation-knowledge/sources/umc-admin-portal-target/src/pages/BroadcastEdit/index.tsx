import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePicker, Form, Radio } from "antd";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CustomButton,
  CustomFooter,
  CustomMessage,
  ConfirmModal,
  FormPanel,
  SelectAllDropdown,
} from "@/components/common";
import type { FormPanelSectionConfig } from "@/components/common/FormPanel";
import {
  getMessageTemplateById,
  addBroadcastTemplate,
  sendBroadcastByNow,
  type BroadcastOperation,
  type BroadcastSendPayload,
  type BroadcastTemplatePayload,
  type MessageTemplateDetail,
} from "@/services/messageTemplate";
import { useUserStore } from "@/store/user";
import { disabledDate } from "@/utils/date";
import ChannelsContent, {
  type BroadcastChannelValues,
  type ChannelsContentRef,
} from "./ChannelsContent";
import { isSmsRecipientMobileMissingError } from "./saveError";
import { isSuccessfulBroadcastResponse } from "./saveResponse";
import { buildBroadcastSendPayload } from "./sendPayload";
import {
  buildBroadcastTemplatePayload,
  getInitialBroadcastFormValues,
  isBroadcastMainFormValid,
  mapDetailToEditState,
  unwrapTemplateDetail,
} from "./broadcastMapper";
import {
  BROADCAST_TIMING_ERROR,
  getBroadcastTimingError,
  type BroadcastTimingError,
} from "./timing";
import {
  BROADCAST_PORTAL,
  BROADCAST_PUBLISH_TYPE,
  EMPTY_CHANNELS,
} from "./constants";
import type { BroadcastFormValues } from "./types";
import { useBroadcastDirtySnapshot } from "./useBroadcastDirtySnapshot";
import { useBroadcastRecipientOptions } from "./useBroadcastRecipientOptions";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import { BROADCAST_LIST_FORCE_REFRESH_EVENT } from "@/pages/Broadcast/refreshEvent";
import "./index.less";

const BroadcastEdit: React.FC = () => {
  const { t, i18n } = useTranslation();
  const be = useCallback(
    (key: string) => String(t(`Settings.broadcast.edit.${key}` as never)),
    [t],
  );
  const getOperationErrorMessage = (
    operation: BroadcastOperation,
    source: unknown,
  ) => {
    const errorCode = source instanceof Error ? source.message : "";
    if (errorCode === BROADCAST_TIMING_ERROR.ExpiryTimeTooSoon) {
      return be("messages.expiryTimeTooSoon");
    }
    if (errorCode === BROADCAST_TIMING_ERROR.DisplayPeriodInvalid) {
      return be("messages.displayPeriodInvalid");
    }
    return isSmsRecipientMobileMissingError(source)
      ? be("messages.smsRecipientMobileMissing")
      : be(
          operation === "DraftAndTest"
            ? "messages.saveAndTestFailed"
            : "messages.publishFailed",
        );
  };
  const history = useHistory();
  const location = useLocation();
  const userInfo = useUserStore((state) => state.userInfo);
  const [form] = Form.useForm();
  const channelsRef = useRef<ChannelsContentRef>(null);
  const searchParams = new URLSearchParams(location.search);
  const id = searchParams.get("id");
  const duplicateId = searchParams.get("duplicateId");

  const [portal, setPortal] = useState<string>(BROADCAST_PORTAL.Customer);
  const [publishTimeType, setPublishTimeType] = useState<string>(BROADCAST_PUBLISH_TYPE.Now);
  const [templateDetail, setTemplateDetail] = useState<MessageTemplateDetail | null>(null);
  const [loadedRecipientsAreAll, setLoadedRecipientsAreAll] = useState(false);
  const [channels, setChannels] = useState<BroadcastChannelValues>(EMPTY_CHANNELS);
  const [channelsValid, setChannelsValid] = useState(false);
  const [mainFormValid, setMainFormValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const loadedChannelsRef = useRef<BroadcastChannelValues>(EMPTY_CHANNELS);
  const { recipientOptions } = useBroadcastRecipientOptions(portal, i18n.language);
  const {
    isDirty,
    resetInitialSnapshot,
    setCurrentSnapshotAsInitial,
  } = useBroadcastDirtySnapshot({
    form,
    channels,
    channelsRef,
  });

  const updateMainFormValidity = useCallback((values: BroadcastFormValues) => {
    setMainFormValid(isBroadcastMainFormValid(values));
  }, []);

  useEffect(() => {
    const initialValues = getInitialBroadcastFormValues();
    form.setFieldsValue(initialValues);
    updateMainFormValidity(initialValues);
    resetInitialSnapshot(initialValues, EMPTY_CHANNELS);
  }, [form, resetInitialSnapshot, updateMainFormValidity]);
  useEffect(() => {
    const targetId = id || duplicateId;
    if (!targetId) return;

    const loadDetail = async () => {
      try {
        const response = await getMessageTemplateById(targetId, "2");
        const data = unwrapTemplateDetail(response);
        if (!data) throw new Error("BROADCAST_TEMPLATE_DETAIL_UNAVAILABLE");
        const detailStatus = Number(data.status);
        if (id && detailStatus !== 0 && detailStatus !== 2) {
          history.replace(`/communications/broadcastView?id=${targetId}`);
          return;
        }
        setTemplateDetail(data);
        const editState = mapDetailToEditState(data);
        setLoadedRecipientsAreAll(editState.loadedRecipientsAreAll);
        setPortal(editState.portal);
        setPublishTimeType(editState.publishTimeType);
        form.setFieldsValue(editState.formValues);
        updateMainFormValidity(editState.formValues);
        loadedChannelsRef.current = editState.channels;
        setChannels(editState.channels);
        resetInitialSnapshot(editState.formValues, editState.channels);
      } catch (error) {
        console.error("Failed to load broadcast template detail", error);
      }
    };
    loadDetail();
  }, [duplicateId, form, history, id, resetInitialSnapshot, updateMainFormValidity]);

  useEffect(() => {
    if (!loadedRecipientsAreAll || recipientOptions.length === 0) return;
    const nextValues = recipientOptions.map((option) => option.value);
    form.setFieldsValue({ userTypes: nextValues });
    updateMainFormValidity(form.getFieldsValue() as BroadcastFormValues);
    resetInitialSnapshot(
      { ...form.getFieldsValue(true), userTypes: nextValues },
      loadedChannelsRef.current,
    );
  }, [form, loadedRecipientsAreAll, recipientOptions, resetInitialSnapshot, updateMainFormValidity]);

  const sections = useMemo<FormPanelSectionConfig[]>(
    () => [
      {
        key: "recipients",
        title: be("sections.recipients"),
        columns: 2,
        items: [
          {
            key: "portal",
            label: be("labels.receivingPortal"),
            colSpan: 1,
            renderEdit: (formInstance) => (
              <Form.Item name="portal" label={be("labels.receivingPortal")} rules={[{ required: true, message: be("validation.receivingPortalRequired") }]}>
                <Radio.Group
                  onChange={(event) => {
                    setPortal(event.target.value);
                    setLoadedRecipientsAreAll(false);
                    formInstance.setFieldsValue({ portal: event.target.value, userTypes: [] });
                    updateMainFormValidity(formInstance.getFieldsValue() as BroadcastFormValues);
                  }}
                >
                  <Radio value={BROADCAST_PORTAL.Customer}>{be("portals.customer")}</Radio>
                  <Radio value={BROADCAST_PORTAL.Admin}>{be("portals.admin")}</Radio>
                </Radio.Group>
              </Form.Item>
            ),
          },
          {
            key: "userTypes",
            label: portal === BROADCAST_PORTAL.Customer ? be("labels.userTypes") : be("labels.departments"),
            colSpan: 1,
            renderEdit: (formInstance) => (
              <Form.Item name="userTypes" label={portal === BROADCAST_PORTAL.Customer ? be("labels.userTypes") : be("labels.departments")} rules={[{ required: true, message: portal === BROADCAST_PORTAL.Customer ? be("validation.userTypesRequired") : be("validation.departmentsRequired") }]}>
                <SelectAllDropdown
                  className="broadcast-edit-page__recipient-select"
                  placeholder={portal === BROADCAST_PORTAL.Customer ? be("placeholders.selectUserTypes") : be("placeholders.selectDepartments")}
                  options={recipientOptions}
                  value={formInstance.getFieldValue("userTypes") || []}
                  onChange={(values) => {
                    setLoadedRecipientsAreAll(false);
                    formInstance.setFieldsValue({ userTypes: values });
                    updateMainFormValidity(formInstance.getFieldsValue() as BroadcastFormValues);
                  }}
                  showSearch
                  maxTagCount={5}
                />
              </Form.Item>
            ),
          },
        ],
      },
      {
        key: "timing",
        title: be("sections.timing"),
        columns: 2,
        items: [
          {
            key: "publishType",
            label: be("labels.publishTime"),
            colSpan: 1,
            renderEdit: () => (
              <Form.Item name="publishType" label={be("labels.publishTime")}>
                <Radio.Group>
                  <Radio value={BROADCAST_PUBLISH_TYPE.Now}>{be("publishTypes.now")}</Radio>
                  <Radio value={BROADCAST_PUBLISH_TYPE.Scheduled}>{be("publishTypes.scheduled")}</Radio>
                </Radio.Group>
              </Form.Item>
            ),
          },
          {
            key: "timeConfig",
            label: publishTimeType === BROADCAST_PUBLISH_TYPE.Now ? be("labels.expiryTime") : be("labels.displayPeriod"),
            colSpan: 1,
            renderEdit: () => publishTimeType === BROADCAST_PUBLISH_TYPE.Now ? (
              <Form.Item name="expiryTime" label={be("labels.expiryTime")} rules={[{ required: true, message: be("validation.expiryTimeRequired") }]}>
                <DatePicker
                  style={{ width: "100%" }}
                  className="custorm-picker"
                  disabledDate={disabledDate}
                  getPopupContainer={(node) => node}
                  placeholder={be("placeholders.selectTime")}
                  format="DD/MM/YYYY HH:mm"
                  showTime
                />
              </Form.Item>
            ) : (
              <Form.Item name="displayPeriod" label={be("labels.displayPeriod")} rules={[{ required: true, message: be("validation.displayPeriodRequired") }]}>
                <DatePicker.RangePicker
                  showTime
                  disabledDate={disabledDate}
                  className="custorm-picker"
                  getPopupContainer={(node) => node}
                  style={{ width: "100%" }}
                  placeholder={[be("placeholders.rangeStart"), be("placeholders.rangeEnd")]}
                  format="DD/MM/YYYY HH:mm"
                />
              </Form.Item>
            ),
          },
        ],
      },
    ],
    [be, portal, publishTimeType, recipientOptions, updateMainFormValidity],
  );

  const buildPayload = async (): Promise<BroadcastTemplatePayload> => {
    const values = await form.validateFields() as BroadcastFormValues;
    const timingError = getBroadcastTimingError({
      ...values,
      publishType: publishTimeType,
    });
    if (timingError) throw new Error(timingError);
    const channelValues = await channelsRef.current?.validate();
    if (!channelValues) throw new Error("CHANNEL_VALUES_UNAVAILABLE");

    return buildBroadcastTemplatePayload({
      values: {
        ...values,
        publishType: publishTimeType,
      },
      channelValues,
      templateDetail,
    });
  };

  const buildOperationPayload = async (
    operation: BroadcastOperation,
  ): Promise<BroadcastSendPayload> => {
    const payload = await buildPayload();
    const operationPayload = operation === "DraftAndTest"
      ? {
          ...payload,
          // The test action is an immediate dispatch preview, so it forces an
          // immediate publish type. The scheduled push time is still forwarded
          // so the backend receives the same timing payload as Publish below.
          publishType: BROADCAST_PUBLISH_TYPE.Now,
        }
      : payload;
    const existingId = id && templateDetail?.id ? templateDetail.id : undefined;

    return buildBroadcastSendPayload(operationPayload, operation, {
      id: existingId,
      userId: userInfo.id,
    });
  };

  const handleSaveAndTest = async () => {
    if (testing || saving) return;
    try {
      setTesting(true);
      const response = await sendBroadcastByNow(
        await buildOperationPayload("DraftAndTest"),
      );
      if (isSuccessfulBroadcastResponse(response)) {
        CustomMessage.success(be("messages.saveAndTestSuccess"));
        setCurrentSnapshotAsInitial();
      } else {
        CustomMessage.error(
          getOperationErrorMessage("DraftAndTest", response),
        );
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      const expectedErrors: Array<BroadcastTimingError | "CHANNEL_REQUIRED"> = [
        "CHANNEL_REQUIRED",
        BROADCAST_TIMING_ERROR.ExpiryTimeTooSoon,
        BROADCAST_TIMING_ERROR.DisplayPeriodInvalid,
      ];
      if (!expectedErrors.includes(errorMessage as BroadcastTimingError)) {
        console.error("Broadcast save and test failed", error);
      }
      CustomMessage.error(
        getOperationErrorMessage("DraftAndTest", error),
      );
    } finally {
      setTesting(false);
    }
  };

  const handlePublish = async () => {
    if (saving || testing) return;
    let returnedToList = false;
    try {
      setSaving(true);
      const response = await addBroadcastTemplate(
        await buildOperationPayload("Publish"),
      );
      if (!isSuccessfulBroadcastResponse(response)) {
        console.error("Broadcast publish rejected by API", response);
        CustomMessage.error(getOperationErrorMessage("Publish", response));
        return;
      }
      CustomMessage.success(be("messages.publishSuccess"));
      setCurrentSnapshotAsInitial();
      returnedToList = true;
      window.dispatchEvent(new Event(BROADCAST_LIST_FORCE_REFRESH_EVENT));
      history.goBack();
    } catch (error) {
      const errorMessage = (error as Error).message;
      const expectedErrors: Array<BroadcastTimingError | "CHANNEL_REQUIRED"> = [
        "CHANNEL_REQUIRED",
        BROADCAST_TIMING_ERROR.ExpiryTimeTooSoon,
        BROADCAST_TIMING_ERROR.DisplayPeriodInvalid,
      ];
      if (!expectedErrors.includes(errorMessage as BroadcastTimingError)) {
        console.error("Broadcast publish failed", error);
      }
      CustomMessage.error(getOperationErrorMessage("Publish", error));
    } finally {
      if (!returnedToList) {
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (isDirty()) {
      setLeaveConfirmVisible(true);
      return;
    }
    history.goBack();
  };

  const handleLeave = () => {
    setLeaveConfirmVisible(false);
    history.goBack();
  };

  const actionsDisabled = !mainFormValid || !channelsValid;
  return (
    <div className="broadcast-edit-page">
      <FormPanel
        form={form}
        mode="edit"
        sections={sections}
        onValuesChange={(changedValues, allValues) => {
          if (changedValues.publishType !== undefined) {
            setPublishTimeType(changedValues.publishType);
            const nextValues = {
              ...allValues,
              expiryTime: undefined,
              displayPeriod: undefined,
            };
            form.setFieldsValue(nextValues);
            updateMainFormValidity(nextValues as BroadcastFormValues);
            return;
          }
          updateMainFormValidity(allValues as BroadcastFormValues);
        }}
      />
      <Form layout="vertical" className="broadcast-edit-page__channels-form">
        <ChannelsContent
          ref={channelsRef}
          value={channels}
          language={i18n.language}
          labels={be}
          onValidityChange={setChannelsValid}
        />
      </Form>
      <CustomFooter
        onBack={handleBack}
        rightContent={
          <>
            <CustomButton
              text={be("buttons.saveAndTest")}
              variant="outline"
              onClick={handleSaveAndTest}
              loading={testing}
              disabled={actionsDisabled || saving}
              permissionCode={PERMISSION_CODES.communications.broadcast.send}
              permissionRoutePath="/communications/broadcastEdit"
            />
            <CustomButton
              text={be("buttons.publish")}
              variant="primary"
              onClick={handlePublish}
              loading={saving}
              disabled={actionsDisabled || testing}
              permissionCode={PERMISSION_CODES.communications.broadcast.publish}
              permissionRoutePath="/communications/broadcastEdit"
            />
          </>
        }
      />
      <ConfirmModal
        visible={leaveConfirmVisible}
        type="danger"
        title={be("confirm.unsavedLeave.title")}
        content={be("confirm.unsavedLeave.content")}
        cancelText={be("buttons.cancel")}
        confirmText={be("buttons.leave")}
        onCancel={() => setLeaveConfirmVisible(false)}
        onConfirm={handleLeave}
      />
    </div>
  );
};

export default BroadcastEdit;
