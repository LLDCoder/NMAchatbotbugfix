/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from 'moment';
import debounce from 'lodash/debounce';
import { DEFAULT_COUNTRY_DIAL_CODE } from '@/components/common/MobileNumberInput';
import { Button, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import SimpleBar from '@/components/SimpleBar';
import {
  getAdminInspectionTaskDetail,
  getInspectionEconomicActivities,
  getInspectionAuthoritiesByEmirateFresh,
  getInspectionCommunitiesByRegionFresh,
  getInspectionEmiratesFresh,
  getInspectionEstablishmentByTradeLicense,
  getInspectionEstablishmentSubTypesFresh,
  getInspectionPrioritiesFresh,
  getInspectionReasonsFresh,
  getInspectionRegionsByEmirateFresh,
  searchInspectionEstablishments,
  searchInspectionIndividuals,
  type InspectionTaskAttachmentPayload,
  type InspectionEstablishmentSearchItem,
  type InspectionGeoLookupOption,
  type InspectionPriorityLookupOption,
  type InspectionReasonLookupOption,
  type InspectionTargetSearchOption,
} from '@/services/inspection';
import { type InspectorSelectOption } from '@/pages/InspectionTaskManagement/components/InspectorSelect';
import { normalizeInspectorIds } from '@/pages/InspectionTaskManagement/components/inspectorSelectUtils';
import DuplicateTaskWarningModal from '@/pages/InspectionTaskManagement/components/DuplicateTaskWarningModal';
import {
  areaOptions as fallbackAreaOptions,
  emirateOptions as fallbackEmirateOptions,
  establishmentSubtypeOptions as fallbackEstablishmentSubtypeOptions,
  getAuthorityOptions as getFallbackAuthorityOptions,
  getInspectionTaskAreaLabel,
  getInspectionTaskAuthorityLabel,
  getInspectionTaskEmirateLabel,
  getInspectionTaskEstablishmentSubtypeLabel,
  getInspectionTaskInspectionMethodLabel,
  getEmirateId,
  inspectionMethodOptions as fallbackInspectionMethodOptions,
  inspectorOptions,
  isEstablishmentSubtypeWithoutLicenseId,
  type TargetType,
} from '@/pages/InspectionTaskManagement/taskConfig';
import InspectionTaskModalSections from './InspectionTaskModalSections';
import {
  createEmptyTaskModalMeta,
} from './helpers';
import ExecutionFields from './components/ExecutionFields';
import TaskInfoFields from './components/TaskInfoFields';
import TargetFields from './components/TargetFields';
import useInspectionTaskModalState from './hooks/useInspectionTaskModalState';
import useInspectionTaskTarget from './hooks/useInspectionTaskTarget';
import useInspectionTaskSubmit from './hooks/useInspectionTaskSubmit';
import useSyncedVisible from './hooks/useSyncedVisible';
import {
  getAssignedInspectorIds,
  getAssignedInspectorOptions,
  mergeInspectorSelectOptions,
} from './utils/inspector';
import {
  findLookupOptionById,
  findLookupOptionByLabel,
  findPriorityOption,
  findReasonOption,
  flattenEconomicActivityOptions,
  getLookupLabel,
  getPriorityLabel,
  getPriorityValue,
  getReasonLabel,
  getReasonSearchText,
  isCampaignReasonOption,
  isCampaignReasonValue,
  mapLookupOptionsToNumberOptions,
  normalizeLookupKey,
  normalizeLookupText,
  toNumberOrUndefined,
} from './utils/lookup';
import {
  getClearedTargetValues,
  getDuplicateDueDateMoment,
  createInspectionTaskMobileFormValue,
  getEstablishmentDisplayName,
  getSelectedTargetOptions,
  mapEstablishmentToTargetOption,
  mapIndividualToTargetOption,
  mapTaskDetailToTargetOption,
  mergeSelectedTargetOption,
  normalizeInspectionMethodValue,
  normalizeTaskAttachments,
} from './utils/target';
import type {
  CampaignActivitySelectOption,
  InspectionTaskModalMeta as TaskModalMeta,
  InspectionTaskModalProps as CreateTaskModalProps,
  StaticSelectOption,
} from './type';

export type { InspectionTaskModalMode } from './type';

const InspectionTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  mode,
  editingTask,
  isInspectorSelfCreate,
  currentInspectorId,
  inspectorOptions: teamInspectorOptions = [],
  inspectorOptionsLoading = false,
  getAuthorityName,
  onVisibleChange,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const campaignEmirateId = Form.useWatch('emirateId', form);
  const selectedEstablishmentSubtypeId = Form.useWatch('establishmentSubTypeId', form);
  const [taskModalMeta, setTaskModalMeta] = useState<TaskModalMeta>(() => createEmptyTaskModalMeta());
  const [targetSearchOptions, setTargetSearchOptions] = useState<InspectionTargetSearchOption[]>([]);
  const [targetSearchLoading, setTargetSearchLoading] = useState(false);
  const [authorityLookupLoading, setAuthorityLookupLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [taskSubmitEnabled, setTaskSubmitEnabled] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState<InspectionTaskAttachmentPayload[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [selectedEmirateName, setSelectedEmirateName] = useState<string | undefined>();
  const [, setSelectedEmirateId] = useState<number | undefined>();
  const [, setSelectedRegionId] = useState<number | undefined>();
  const [emirateLookupOptions, setEmirateLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [authorityLookupOptions, setAuthorityLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [regionLookupOptions, setRegionLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [communityLookupOptions, setCommunityLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [establishmentSubtypeLookupOptions, setEstablishmentSubtypeLookupOptions] = useState<InspectionGeoLookupOption[]>([]);
  const [reasonLookupOptions, setReasonLookupOptions] = useState<InspectionReasonLookupOption[]>([]);
  const [priorityLookupOptions, setPriorityLookupOptions] = useState<InspectionPriorityLookupOption[]>([]);
  const [campaignActivityOptions, setCampaignActivityOptions] = useState<CampaignActivitySelectOption[]>([]);
  const [campaignActivityLoading, setCampaignActivityLoading] = useState(false);
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false);
  const [reasonSearchKeyword, setReasonSearchKeyword] = useState('');
  const [assignmentInspectorOptions, setAssignmentInspectorOptions] = useState<InspectorSelectOption[]>([]);
  const reasonLookupOptionsRef = useRef<InspectionReasonLookupOption[]>([]);
  const targetSearchRequestRef = useRef(0);
  const manualLookupRequestRef = useRef(0);
  const emirateRelatedLookupRequestRef = useRef(0);
  const selectedTargetRef = useRef<InspectionTargetSearchOption | null>(null);
  const syncedVisible = useSyncedVisible(visible, onVisibleChange);
  const {
    duplicateTaskWarning,
    setDuplicateTaskWarning,
    closeModal,
    closeDuplicateTaskWarning,
    confirmDuplicateTaskWarning,
  } = useInspectionTaskModalState({ syncedVisible });
  const inspectionReasonCode = taskModalMeta.inspectionReasonCode;
  const isCampaignReason = isCampaignReasonValue(reasonLookupOptions, inspectionReasonCode);
  const currentTargetType = taskModalMeta.targetType;
  const isCreateLikeMode = mode === 'create' || mode === 'duplicate';
  const isCampaignCreateMode = mode === 'create' && isCampaignReason;
  const isReadonlyTarget = Boolean((taskModalMeta.selectedTarget && !taskModalMeta.manualTarget) || taskModalMeta.autoMatchedTarget);
  const shouldShowRegion = selectedEmirateName === 'Abu Dhabi';
  const reasonOptions = useMemo(() => reasonLookupOptions
    .filter((item) => Boolean(item.code))
    .filter((item) => !isInspectorSelfCreate || !isCampaignReasonOption(item))
    .map((item) => ({
      ...item,
      value: String(item.code),
      label: getReasonLabel(item),
    }))
    .filter((item) => item.value && item.label), [isInspectorSelfCreate, reasonLookupOptions]);
  const filteredReasonOptions = useMemo(() => {
    const normalized = normalizeLookupText(reasonSearchKeyword);
    if (!normalized) return reasonOptions;

    return reasonOptions.filter((item) => getReasonSearchText(item).includes(normalized));
  }, [reasonOptions, reasonSearchKeyword]);
  const prioritySelectOptions = useMemo(() => priorityLookupOptions
    .map((item) => ({
      value: getPriorityValue(item),
      label: getPriorityLabel(item),
    }))
    .filter((item) => item.value && item.label), [priorityLookupOptions]);
  const inspectionMethodSelectOptions = useMemo<StaticSelectOption[]>(
    () => fallbackInspectionMethodOptions.map((item) => ({
      value: item,
      label: getInspectionTaskInspectionMethodLabel(item, t),
    })),
    [t],
  );
  const emirateSelectOptions = useMemo(() => (
    emirateLookupOptions.length
      ? emirateLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackEmirateOptions.map((item) => ({
        value: item,
        label: getInspectionTaskEmirateLabel(item, t),
      }))
  ), [emirateLookupOptions, t]);
  const establishmentSubtypeSelectOptions = useMemo(() => (
    establishmentSubtypeLookupOptions.length
      ? establishmentSubtypeLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackEstablishmentSubtypeOptions.map((item) => ({
        value: item,
        label: getInspectionTaskEstablishmentSubtypeLabel(item, t),
      }))
  ), [establishmentSubtypeLookupOptions, t]);
  const isLicenseExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(selectedEstablishmentSubtypeId);
  const authoritySelectOptions = useMemo(() => (
    authorityLookupOptions.length
      ? authorityLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : getFallbackAuthorityOptions(selectedEmirateName).map((item) => ({
        value: item,
        label: getInspectionTaskAuthorityLabel(item, t),
      }))
  ), [authorityLookupOptions, selectedEmirateName, t]);
  const campaignEmirateSelectOptions = useMemo(
    () => mapLookupOptionsToNumberOptions(emirateLookupOptions),
    [emirateLookupOptions],
  );
  const campaignAuthoritySelectOptions = useMemo(
    () => mapLookupOptionsToNumberOptions(authorityLookupOptions),
    [authorityLookupOptions],
  );
  const regionSelectOptions = useMemo(() => (
    regionLookupOptions.length
      ? regionLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackAreaOptions.map((item) => ({
        value: item,
        label: getInspectionTaskAreaLabel(item, t),
      }))
  ), [regionLookupOptions, t]);
  const communitySelectOptions = useMemo(() => (
    communityLookupOptions.length
      ? communityLookupOptions
        .map((item) => getLookupLabel(item))
        .filter(Boolean)
        .map((item) => ({ value: item, label: item }))
      : fallbackAreaOptions.map((item) => ({
        value: item,
        label: getInspectionTaskAreaLabel(item, t),
      }))
  ), [communityLookupOptions, t]);
  const resolvedInspectorOptions = useMemo(
    () => mergeInspectorSelectOptions(teamInspectorOptions, assignmentInspectorOptions),
    [assignmentInspectorOptions, teamInspectorOptions],
  );
  const inspectorSubmitLookupOptions = useMemo(
    () => mergeInspectorSelectOptions(
      resolvedInspectorOptions,
      inspectorOptions.map((item) => ({ id: item.id, name: item.name })),
    ),
    [resolvedInspectorOptions],
  );

  useEffect(() => {
    selectedTargetRef.current = taskModalMeta.selectedTarget || null;
  }, [taskModalMeta.selectedTarget]);

  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      setCampaignActivityOptions([]);
      setCampaignActivityLoading(false);
      setAssignmentInspectorOptions([]);
      return undefined;
    }

    setCampaignActivityLoading(true);
    getInspectionEconomicActivities()
      .then((activities) => {
        if (!cancelled) {
          setCampaignActivityOptions(flattenEconomicActivityOptions(activities));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaignActivityOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCampaignActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const getTaskSubmitEnabled = useCallback((
    meta: TaskModalMeta,
    lookupOptions: InspectionReasonLookupOption[] = reasonLookupOptionsRef.current,
  ) => {
    const values = form.getFieldsValue(true);
    const hasReason = Boolean(values.inspectionReasonCode);
    const hasPriority = Boolean(values.priorityCode);
    const hasDueDate = Boolean(values.dueDate);
    const hasRemarks = true;
    const isCampaign = mode === 'create' && isCampaignReasonValue(lookupOptions, meta.inspectionReasonCode);

    if (isCampaign) {
      const valid = hasReason && hasPriority && hasDueDate && values.emirateId && values.authorityId && values.activityIds?.length;
      return Boolean(valid && hasRemarks);
    }

    const hasInspector = isInspectorSelfCreate || normalizeInspectorIds(values.assignedInspector).length > 0;
    const hasMethod = Boolean(values.inspectionMethod);
    if (meta.targetType === 'establishment') {
      const hasRegion = values.emirateNameEn === 'Abu Dhabi' ? Boolean(values.region) : true;
      const hasLicenseFields = isEstablishmentSubtypeWithoutLicenseId(values.establishmentSubTypeId)
        ? true
        : Boolean(values.tradeLicenseNumber && values.authorityNameEn);
      const valid = meta.manualTarget || meta.selectedTarget
        ? Boolean(
          values.establishmentSubType &&
          values.emirateNameEn &&
          values.establishmentNameEn &&
          values.area &&
          values.street &&
          hasRegion &&
          hasLicenseFields,
        )
        : Boolean(meta.selectedTarget);
      return Boolean(hasReason && hasPriority && hasMethod && hasInspector && hasDueDate && valid);
    }

    const valid = meta.manualTarget || meta.selectedTarget
      ? Boolean(values.fullName && values.email)
      : Boolean(meta.selectedTarget);
    return Boolean(hasReason && hasPriority && hasMethod && hasInspector && hasDueDate && valid);
  }, [form, isInspectorSelfCreate, mode]);

  const clearBaseLookupOptions = useCallback(() => {
    reasonLookupOptionsRef.current = [];
    setReasonLookupOptions([]);
    setPriorityLookupOptions([]);
    setEmirateLookupOptions([]);
    setEstablishmentSubtypeLookupOptions([]);
  }, []);

  const loadBaseLookups = useCallback(async () => {
    const [reasons, priorities, emirates, subTypes] = await Promise.all([
      getInspectionReasonsFresh(),
      getInspectionPrioritiesFresh(),
      getInspectionEmiratesFresh(),
      getInspectionEstablishmentSubTypesFresh(),
    ]);
    reasonLookupOptionsRef.current = reasons;
    setReasonLookupOptions(reasons);
    setPriorityLookupOptions(priorities);
    setEmirateLookupOptions(emirates);
    setEstablishmentSubtypeLookupOptions(subTypes);
    return { reasons, priorities };
  }, []);

  const loadEmirateRelatedLookups = useCallback(async (emirateId?: number) => {
    emirateRelatedLookupRequestRef.current += 1;
    const requestId = emirateRelatedLookupRequestRef.current;
    setAuthorityLookupOptions([]);
    setRegionLookupOptions([]);
    setCommunityLookupOptions([]);
    setSelectedRegionId(undefined);
    if (!emirateId) {
      setAuthorityLookupLoading(false);
      return;
    }
    setAuthorityLookupLoading(true);
    try {
      const [authorities, regions] = await Promise.all([
        getInspectionAuthoritiesByEmirateFresh(emirateId),
        getInspectionRegionsByEmirateFresh(emirateId),
      ]);
      if (requestId !== emirateRelatedLookupRequestRef.current) {
        return;
      }
      setAuthorityLookupOptions(authorities);
      setRegionLookupOptions(regions);
    } finally {
      if (requestId === emirateRelatedLookupRequestRef.current) {
        setAuthorityLookupLoading(false);
      }
    }
  }, []);

  const loadRegionCommunities = useCallback(async (regionId?: number) => {
    setCommunityLookupOptions([]);
    if (!regionId) {
      return;
    }
    const communities = await getInspectionCommunitiesByRegionFresh(regionId);
    setCommunityLookupOptions(communities);
  }, []);

  const runTargetSearch = useCallback(async (targetType: TargetType, searchText: string) => {
    const keyword = searchText.trim();
    targetSearchRequestRef.current += 1;
    const requestId = targetSearchRequestRef.current;
    if (!keyword) {
      setTargetSearchOptions(getSelectedTargetOptions(selectedTargetRef.current, targetType));
      setTargetSearchLoading(false);
      return;
    }

    setTargetSearchLoading(true);
    try {
      const values = form.getFieldsValue(true);
      const emirateId = toNumberOrUndefined(values.emirateId)
        || toNumberOrUndefined(findLookupOptionByLabel(emirateLookupOptions, values.emirateNameEn)?.id);
      const options = targetType === 'establishment'
        ? (await searchInspectionEstablishments({
          keyword,
          emirateId,
          pageIndex: 1,
          pageSize: 20,
        })).map(mapEstablishmentToTargetOption)
        : (await searchInspectionIndividuals({
          keyword,
          pageIndex: 1,
          pageSize: 20,
        })).map(mapIndividualToTargetOption);
      if (requestId === targetSearchRequestRef.current) {
        const selectedTarget = selectedTargetRef.current;
        setTargetSearchOptions(
          selectedTarget?.targetType === targetType
            ? mergeSelectedTargetOption(options, selectedTarget)
            : options,
        );
      }
    } catch {
      if (requestId === targetSearchRequestRef.current) {
        setTargetSearchOptions(getSelectedTargetOptions(selectedTargetRef.current, targetType));
      }
    } finally {
      if (requestId === targetSearchRequestRef.current) {
        setTargetSearchLoading(false);
      }
    }
  }, [emirateLookupOptions, form]);

  const debouncedTargetSearch = useMemo(
    () => debounce(runTargetSearch, 350),
    [runTargetSearch],
  );

  const getDefaultCreateValues = useCallback((): Record<string, any> & { targetType: TargetType } => {
    return {
      inspectionReasonCode: undefined,
      priorityCode: undefined,
      targetType: 'establishment',
      targetSearch: undefined,
      establishmentId: undefined,
      individualId: undefined,
      userProfileId: undefined,
      hasRegisteredProfile: undefined,
      establishmentSubTypeId: undefined,
      emirateId: undefined,
      authorityId: undefined,
      regionId: undefined,
      communityId: undefined,
      areaId: undefined,
      latitude: undefined,
      longitude: undefined,
      mapLocationUrl: undefined,
      establishmentSubType: undefined,
      emirateNameEn: undefined,
      authorityNameEn: undefined,
      tradeLicenseNumber: undefined,
      establishmentNameEn: undefined,
      region: undefined,
      area: undefined,
      street: undefined,
      eid: undefined,
      fullName: undefined,
      email: undefined,
      mobileNumber: createInspectionTaskMobileFormValue({ countryCode: DEFAULT_COUNTRY_DIAL_CODE }),
      mediaLicenseNumber: undefined,
      socialMediaAccountUsername: undefined,
      activityNameEn: undefined,
      activityIds: undefined,
      inspectionMethod: undefined,
      assignedInspector: isInspectorSelfCreate ? currentInspectorId : undefined,
      dueDate: null,
      description: undefined,
    };
  }, [currentInspectorId, isInspectorSelfCreate]);

  const applyTargetPayload = useCallback((option: InspectionTargetSearchOption) => {
    const payload = option.payload as Record<string, any>;
    const currentInspectionMethod = form.getFieldValue('inspectionMethod');
    form.setFieldsValue({
      ...payload,
      inspectionMethod: option.targetType === 'establishment'
        ? payload.inspectionMethod
        : payload.inspectionMethod || currentInspectionMethod,
    });
    setSelectedEmirateName(payload.emirateNameEn);
    setSelectedEmirateId(toNumberOrUndefined(payload.emirateId));
    setSelectedRegionId(toNumberOrUndefined(payload.regionId));
    void loadEmirateRelatedLookups(toNumberOrUndefined(payload.emirateId)).catch(() => undefined);
    void loadRegionCommunities(toNumberOrUndefined(payload.regionId)).catch(() => undefined);
  }, [form, loadEmirateRelatedLookups, loadRegionCommunities]);

  const applyAutoMatchedTarget = useCallback((option: InspectionTargetSearchOption) => {
    applyTargetPayload(option);
    setTaskModalMeta((current) => {
      if (!current.manualTarget || current.selectedTarget || current.targetType !== option.targetType) {
        return current;
      }
      const nextMeta = {
        ...current,
        autoMatchedTarget: option,
        targetSearch: option.title,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [applyTargetPayload, getTaskSubmitEnabled]);

  const clearAutoMatchedTarget = useCallback((targetType: TargetType, requestId: number) => {
    if (requestId !== manualLookupRequestRef.current) return;
    setTaskModalMeta((current) => {
      if (!current.manualTarget || current.selectedTarget || current.targetType !== targetType || !current.autoMatchedTarget) {
        return current;
      }
      const nextMeta = {
        ...current,
        autoMatchedTarget: null,
      };
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      return nextMeta;
    });
  }, [getTaskSubmitEnabled]);

  const runManualTargetLookup = useCallback(async (meta: TaskModalMeta, values: Record<string, any>) => {
    if (!meta.manualTarget || meta.selectedTarget) return;
    manualLookupRequestRef.current += 1;
    const requestId = manualLookupRequestRef.current;
    const targetType = meta.targetType;

    try {
      if (targetType === 'establishment') {
        const emirateId = toNumberOrUndefined(values.emirateId)
          || toNumberOrUndefined(findLookupOptionByLabel(emirateLookupOptions, values.emirateNameEn)?.id)
          || (values.emirateNameEn ? getEmirateId(values.emirateNameEn) : undefined);
        if (!emirateId) {
          clearAutoMatchedTarget(targetType, requestId);
          return;
        }

        const isExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(values.establishmentSubTypeId);
        let establishment: InspectionEstablishmentSearchItem | null = null;
        if (!isExemptSubtype && values.tradeLicenseNumber) {
          establishment = await getInspectionEstablishmentByTradeLicense({
            emirateId,
            tradeLicenseNumber: String(values.tradeLicenseNumber).trim(),
          });
        } else if (isExemptSubtype && values.establishmentNameEn) {
          const exactName = normalizeLookupKey(values.establishmentNameEn);
          const establishments = await searchInspectionEstablishments({
            emirateId,
            keyword: String(values.establishmentNameEn).trim(),
            pageIndex: 1,
            pageSize: 20,
          });
          establishment = establishments.find((item) =>
            normalizeLookupKey(getEstablishmentDisplayName(item)) === exactName,
          ) || null;
        }

        if (requestId !== manualLookupRequestRef.current) return;
        if (establishment) {
          applyAutoMatchedTarget(mapEstablishmentToTargetOption(establishment));
        } else {
          clearAutoMatchedTarget(targetType, requestId);
        }
        return;
      }

      const eid = String(values.eid || '').trim();
      if (!eid) {
        clearAutoMatchedTarget(targetType, requestId);
        return;
      }
      const individuals = await searchInspectionIndividuals({
        keyword: eid,
        pageIndex: 1,
        pageSize: 20,
      });
      if (requestId !== manualLookupRequestRef.current) return;
      const exactEid = normalizeLookupKey(eid);
      const individual = individuals.find((item) => normalizeLookupKey(item.emiratesId) === exactEid) || null;
      if (individual) {
        applyAutoMatchedTarget(mapIndividualToTargetOption(individual));
      } else {
        clearAutoMatchedTarget(targetType, requestId);
      }
    } catch {
      clearAutoMatchedTarget(targetType, requestId);
    }
  }, [
    applyAutoMatchedTarget,
    clearAutoMatchedTarget,
    emirateLookupOptions,
  ]);

  const debouncedManualTargetLookup = useMemo(
    () => debounce(runManualTargetLookup, 450),
    [runManualTargetLookup],
  );

  useEffect(() => () => {
    debouncedTargetSearch.cancel();
    debouncedManualTargetLookup.cancel();
  }, [debouncedManualTargetLookup, debouncedTargetSearch]);

  const clearTargetFormValues = useCallback((targetType: TargetType, overrides: Record<string, any> = {}) => {
    form.setFieldsValue(getClearedTargetValues(targetType, {
      mobileNumber: createInspectionTaskMobileFormValue({
        countryCode: isCreateLikeMode ? DEFAULT_COUNTRY_DIAL_CODE : '',
      }),
      ...overrides,
    }));
    setSelectedEmirateName(overrides.emirateNameEn);
    setSelectedEmirateId(toNumberOrUndefined(overrides.emirateId));
    setSelectedRegionId(toNumberOrUndefined(overrides.regionId));
    if (!overrides.emirateId) {
      emirateRelatedLookupRequestRef.current += 1;
      setAuthorityLookupOptions([]);
      setRegionLookupOptions([]);
      setCommunityLookupOptions([]);
      setAuthorityLookupLoading(false);
    }
  }, [form, isCreateLikeMode]);

  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      form.resetFields();
      setTaskModalMeta(createEmptyTaskModalMeta());
      setTaskSubmitEnabled(false);
      clearBaseLookupOptions();
      setTaskAttachments([]);
      setAttachmentUploading(false);
      setSelectedEmirateName(undefined);
      setSelectedEmirateId(undefined);
      setSelectedRegionId(undefined);
      setTargetSearchOptions([]);
      setTargetSearchLoading(false);
      setDetailLoading(false);
      emirateRelatedLookupRequestRef.current += 1;
      setAuthorityLookupOptions([]);
      setRegionLookupOptions([]);
      setCommunityLookupOptions([]);
      setAuthorityLookupLoading(false);
      setReasonDropdownOpen(false);
      setReasonSearchKeyword('');
      return undefined;
    }

    setTaskAttachments([]);
    clearBaseLookupOptions();
    setAttachmentUploading(false);
    setTargetSearchOptions([]);
    setTargetSearchLoading(false);
    setReasonDropdownOpen(false);
    setReasonSearchKeyword('');

    const hydrateModal = async () => {
      const { reasons, priorities } = await loadBaseLookups();
      if (cancelled) return;

      if (mode === 'create' || !editingTask) {
        const defaults = getDefaultCreateValues();
        const nextMeta: TaskModalMeta = {
          inspectionReasonCode: '',
          targetType: defaults.targetType,
          manualTarget: false,
          targetSearch: '',
          selectedTarget: null,
          autoMatchedTarget: null,
        };
        form.setFieldsValue(defaults);
        setTaskModalMeta(nextMeta);
        setSelectedEmirateName(undefined);
        setSelectedEmirateId(undefined);
        setSelectedRegionId(undefined);
        setAssignmentInspectorOptions([]);
        setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
        return;
      }

      setAssignmentInspectorOptions([]);
      setDetailLoading(true);
      const detailResponse = await getAdminInspectionTaskDetail({
        taskId: editingTask.taskId || editingTask.sourceId,
        taskNo: editingTask.taskNo,
      }).catch(() => null);
      if (cancelled) return;
      const detailTask = detailResponse?.data || editingTask;
      const target = detailTask?.inspectionTarget || {};
      const address = target.address || {};
      const targetType: TargetType = Number(target.targetType) === 2 ? 'individual' : 'establishment';
      const inspectionConfig = detailTask.inspectionConfig || {};
      const inspectionMethod = normalizeInspectionMethodValue(inspectionConfig) || 'Field Inspection';
      const assignedInspectorIds = getAssignedInspectorIds(detailTask?.assignment);
      const assignedInspectorOptions = getAssignedInspectorOptions(detailTask?.assignment);
      const emirateId = toNumberOrUndefined(address.emirateId)
        || (address.emirateNameEn ? getEmirateId(address.emirateNameEn) : undefined);
      const regionId = toNumberOrUndefined(address.regionId);
      const areaId = toNumberOrUndefined(address.areaId || address.communityId);
      const targetName = target.fullName || target.establishmentNameEn;
      const regionName = address.regionNameEn || (address.communityId ? undefined : address.communityNameEn);
      const areaName = address.areaNameEn || address.communityNameEn;
      const reasonOption = findReasonOption(reasons, inspectionConfig.inspectionReasonCode)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonId)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonNameEn)
        || findReasonOption(reasons, inspectionConfig.inspectionReasonNameAr);
      const inspectionReasonCode = reasonOption?.code ? String(reasonOption.code) : undefined;
      const priorityOption = findPriorityOption(priorities, inspectionConfig.priorityCode)
        || findPriorityOption(priorities, inspectionConfig.priorityId)
        || findPriorityOption(priorities, inspectionConfig.priorityNameEn)
        || findPriorityOption(priorities, inspectionConfig.priorityNameAr);
      const priorityCode = priorityOption?.code
        ? String(priorityOption.code)
        : inspectionConfig.priorityCode || (inspectionConfig.priorityId ? String(inspectionConfig.priorityId) : undefined);
      const values = {
        inspectionReasonCode,
        priorityCode,
        targetType,
        targetSearch: targetName,
        establishmentId: target.establishmentId,
        individualId: target.individualId,
        userProfileId: target.userProfileId,
        userId: target.userId,
        hasRegisteredProfile: target.hasRegisteredProfile,
        establishmentSubTypeId: target.establishmentSubTypeId,
        establishmentSubType: target.establishmentSubType || (targetType === 'establishment' ? target.targetTypeName || 'Commercial' : undefined),
        emirateId,
        emirateNameEn: address.emirateNameEn,
        authorityId: address.authorityId,
        authorityNameEn: address.authorityNameEn || getAuthorityName(detailTask),
        regionId,
        region: regionName,
        communityId: address.communityId,
        areaId,
        area: areaName,
        street: address.street,
        latitude: address.latitude,
        longitude: address.longitude,
        mapLocationUrl: address.mapLocationUrl,
        tradeLicenseNumber: target.licenseNumber,
        establishmentNameEn: target.establishmentNameEn,
        eid: target.emiratesId || target.licenseNumber,
        fullName: target.fullName || target.establishmentNameEn,
        email: target.email,
        mobileNumber: createInspectionTaskMobileFormValue({
          countryCode: target.mobileCountryCode,
          localNumber: target.mobileLocalNumber,
          fullNumber: target.mobile,
        }),
        mediaLicenseNumber: target.mediaLicenseNumber,
        socialMediaAccountUsername: target.socialMediaAccountUsername,
        activityNameEn: target.economicActivityName
          ? String(target.economicActivityName).split(', ')
          : undefined,
        inspectionMethod,
        assignedInspector: isInspectorSelfCreate ? assignedInspectorIds[0] : assignedInspectorIds,
        dueDate: mode === 'duplicate'
          ? getDuplicateDueDateMoment(
            editingTask?.dueDate ||
            inspectionConfig.dueDate ||
            editingTask?.dueDateValue,
          )
          : inspectionConfig.dueDate
            ? moment(inspectionConfig.dueDate)
            : null,
        description: detailTask.description,
      };
      const editTargetOption = mapTaskDetailToTargetOption(detailTask, values, targetType);
      const nextMeta: TaskModalMeta = {
        inspectionReasonCode: values.inspectionReasonCode || '',
        targetType,
        manualTarget: false,
        targetSearch: editTargetOption.title,
        selectedTarget: editTargetOption,
        autoMatchedTarget: null,
      };
      form.setFieldsValue({ ...values, targetSearch: editTargetOption.value });
      setTaskAttachments(normalizeTaskAttachments(detailTask.attachments));
      setTargetSearchOptions([editTargetOption]);
      setTaskModalMeta(nextMeta);
      setAssignmentInspectorOptions(assignedInspectorOptions);
      setSelectedEmirateName(values.emirateNameEn);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(regionId);
      await loadEmirateRelatedLookups(emirateId);
      await loadRegionCommunities(regionId);
      if (cancelled) return;
      setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
      setDetailLoading(false);
    };

    hydrateModal().catch(() => {
      if (!cancelled) {
        setDetailLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    editingTask,
    clearBaseLookupOptions,
    form,
    getAuthorityName,
    getDefaultCreateValues,
    getTaskSubmitEnabled,
    isInspectorSelfCreate,
    loadBaseLookups,
    loadEmirateRelatedLookups,
    loadRegionCommunities,
    mode,
    visible,
  ]);

  const handleTaskFormValuesChange = useCallback((changedValues: Record<string, any>, allValues: Record<string, any>) => {
    let nextMeta = taskModalMeta;
    const fieldPatch: Record<string, any> = {};

    if (Object.prototype.hasOwnProperty.call(changedValues, 'inspectionReasonCode')) {
      const nextReasonCode = changedValues.inspectionReasonCode || '';
      const campaign = mode === 'create' && isCampaignReasonValue(reasonLookupOptions, nextReasonCode);
      nextMeta = {
        ...nextMeta,
        inspectionReasonCode: nextReasonCode,
        targetType: campaign ? 'establishment' : nextMeta.targetType,
        manualTarget: campaign ? false : nextMeta.manualTarget,
        selectedTarget: campaign ? null : nextMeta.selectedTarget,
        autoMatchedTarget: campaign ? null : nextMeta.autoMatchedTarget,
      };
      if (campaign) {
        selectedTargetRef.current = null;
        emirateRelatedLookupRequestRef.current += 1;
        setSelectedEmirateName(undefined);
        setAuthorityLookupOptions([]);
        setAuthorityLookupLoading(false);
        form.setFieldsValue({
          targetType: 'establishment',
          targetSearch: undefined,
          inspectionMethod: undefined,
          assignedInspector: undefined,
          establishmentId: undefined,
          individualId: undefined,
          userProfileId: undefined,
          hasRegisteredProfile: undefined,
          establishmentSubTypeId: undefined,
          emirateId: undefined,
          authorityId: undefined,
          regionId: undefined,
          communityId: undefined,
          areaId: undefined,
          establishmentSubType: undefined,
          emirateNameEn: undefined,
          authorityNameEn: undefined,
          tradeLicenseNumber: undefined,
          establishmentNameEn: undefined,
          region: undefined,
          area: undefined,
          street: undefined,
          eid: undefined,
          fullName: undefined,
          email: undefined,
          mobileNumber: createInspectionTaskMobileFormValue({ countryCode: DEFAULT_COUNTRY_DIAL_CODE }),
          activityNameEn: undefined,
          activityIds: undefined,
        });
      } else {
        setAuthorityLookupLoading(false);
        form.setFieldsValue({
          activityIds: undefined,
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'emirateId')) {
      const emirateId = toNumberOrUndefined(allValues.emirateId);
      const emirateOption = findLookupOptionById(emirateLookupOptions, emirateId);
      const emirateName = getLookupLabel(emirateOption);
      fieldPatch.emirateNameEn = emirateName || undefined;
      fieldPatch.authorityId = undefined;
      fieldPatch.authorityNameEn = undefined;
      fieldPatch.regionId = undefined;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      setSelectedEmirateName(emirateName || undefined);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(undefined);
      void loadEmirateRelatedLookups(emirateId).catch(() => undefined);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'authorityId')) {
      const authorityOption = findLookupOptionById(authorityLookupOptions, allValues.authorityId);
      fieldPatch.authorityNameEn = getLookupLabel(authorityOption) || undefined;
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'targetType')) {
      const targetType = changedValues.targetType as TargetType;
      const keepManualTarget = Boolean(nextMeta.manualTarget);
      selectedTargetRef.current = null;
      nextMeta = {
        ...nextMeta,
        targetType,
        manualTarget: keepManualTarget,
        targetSearch: '',
        selectedTarget: null,
        autoMatchedTarget: null,
      };
      setTargetSearchOptions([]);
      clearTargetFormValues(
        targetType,
        keepManualTarget && targetType === 'establishment' ? { establishmentSubType: 'Commercial' } : {},
      );
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'emirateNameEn')) {
      const emirateOption = findLookupOptionByLabel(emirateLookupOptions, allValues.emirateNameEn);
      const emirateId = toNumberOrUndefined(emirateOption?.id)
        || (allValues.emirateNameEn ? getEmirateId(allValues.emirateNameEn) : undefined);
      fieldPatch.emirateId = emirateId;
      fieldPatch.authorityId = undefined;
      fieldPatch.regionId = undefined;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      setSelectedEmirateName(allValues.emirateNameEn);
      setSelectedEmirateId(emirateId);
      setSelectedRegionId(undefined);
      void loadEmirateRelatedLookups(emirateId).catch(() => undefined);
      if (!allValues.emirateNameEn) {
        form.setFieldsValue({
          authorityNameEn: undefined,
          region: undefined,
          area: undefined,
          ...fieldPatch,
        });
        setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
        return;
      }
      const isNextLicenseExemptSubtype = isEstablishmentSubtypeWithoutLicenseId(allValues.establishmentSubTypeId);
      const nextValues: Record<string, any> = {};
      if (allValues.emirateNameEn !== 'Abu Dhabi') {
        nextValues.region = undefined;
      }
      if (isNextLicenseExemptSubtype) {
        nextValues.authorityNameEn = undefined;
      } else {
        const nextAuthority = getFallbackAuthorityOptions(allValues.emirateNameEn)[0];
        if (!allValues.authorityNameEn || String(allValues.authorityNameEn).includes('Authority')) {
          nextValues.authorityNameEn = nextAuthority;
        }
      }
      if (Object.keys(nextValues).length) {
        form.setFieldsValue({ ...nextValues, ...fieldPatch });
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'authorityNameEn')) {
      const authorityOption = findLookupOptionByLabel(authorityLookupOptions, allValues.authorityNameEn);
      fieldPatch.authorityId = toNumberOrUndefined(authorityOption?.id);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'region')) {
      const regionOption = findLookupOptionByLabel(regionLookupOptions, allValues.region);
      const regionId = toNumberOrUndefined(regionOption?.id);
      fieldPatch.regionId = regionId;
      fieldPatch.communityId = undefined;
      fieldPatch.areaId = undefined;
      fieldPatch.area = undefined;
      setSelectedRegionId(regionId);
      void loadRegionCommunities(regionId).catch(() => undefined);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'area')) {
      const communityOption = findLookupOptionByLabel(communityLookupOptions, allValues.area);
      const areaId = toNumberOrUndefined(communityOption?.id);
      fieldPatch.communityId = areaId;
      fieldPatch.areaId = areaId;
    }

    if (Object.keys(fieldPatch).length) {
      form.setFieldsValue(fieldPatch);
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'targetSearch')) {
      nextMeta = {
        ...nextMeta,
        targetSearch: changedValues.targetSearch || '',
      };
      if (!changedValues.targetSearch) {
        nextMeta = {
          ...nextMeta,
          selectedTarget: null,
          autoMatchedTarget: null,
        };
      }
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'establishmentSubType')) {
      const subtypeOption = findLookupOptionByLabel(establishmentSubtypeLookupOptions, changedValues.establishmentSubType);
      const establishmentSubTypeId = toNumberOrUndefined(subtypeOption?.id);
      form.setFieldsValue({
        establishmentSubTypeId,
      });
      if (isEstablishmentSubtypeWithoutLicenseId(establishmentSubTypeId)) {
        form.setFieldsValue({
          tradeLicenseNumber: undefined,
          authorityId: undefined,
          authorityNameEn: undefined,
        });
      } else if (allValues.emirateNameEn && !allValues.authorityNameEn) {
        form.setFieldsValue({
          authorityNameEn: getFallbackAuthorityOptions(allValues.emirateNameEn)[0],
        });
      }
    }

    const isNextCampaign =
      mode === 'create' &&
      isCampaignReasonValue(reasonLookupOptions, nextMeta.inspectionReasonCode);

    if (!isNextCampaign && nextMeta.manualTarget && !nextMeta.selectedTarget) {
      debouncedManualTargetLookup(nextMeta, {
        ...allValues,
        ...form.getFieldsValue(true),
        ...fieldPatch,
      });
    }

    if (nextMeta !== taskModalMeta) {
      setTaskModalMeta(nextMeta);
    }
    setTaskSubmitEnabled(getTaskSubmitEnabled(nextMeta));
  }, [
    clearTargetFormValues,
    authorityLookupOptions,
    communityLookupOptions,
    debouncedManualTargetLookup,
    emirateLookupOptions,
    establishmentSubtypeLookupOptions,
    form,
    getTaskSubmitEnabled,
    loadEmirateRelatedLookups,
    loadRegionCommunities,
    mode,
    reasonLookupOptions,
    regionLookupOptions,
    taskModalMeta,
  ]);

  const {
    handleTargetSearch,
    handleTargetSelect,
    handleTargetFocus,
    handleTargetClear,
    handleManualTargetStart,
  } = useInspectionTaskTarget({
    form,
    currentTargetType,
    taskModalMeta,
    targetSearchOptions,
    selectedTargetRef,
    debouncedTargetSearch,
    applyTargetPayload,
    clearTargetFormValues,
    getTaskSubmitEnabled,
    setTaskModalMeta,
    setTargetSearchOptions,
    setTargetSearchLoading,
    setTaskSubmitEnabled,
  });

  const handleReasonDropdownVisibleChange = useCallback((open: boolean) => {
    setReasonDropdownOpen(open);
    if (!open) {
      setReasonSearchKeyword('');
    }
  }, []);

  const handleReasonSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setReasonDropdownOpen(true);
    setReasonSearchKeyword(event.target.value);
  }, []);

  const handleReasonSearchClear = useCallback(() => {
    setReasonSearchKeyword('');
  }, []);

  const handleReasonSelect = useCallback(() => {
    setReasonSearchKeyword('');
  }, []);

  const handleTaskSubmit = useInspectionTaskSubmit({
    form,
    mode,
    editingTask,
    detailLoading,
    attachmentUploading,
    isCampaignReason,
    isInspectorSelfCreate,
    currentInspectorId,
    inspectorSubmitLookupOptions,
    reasonLookupOptions,
    priorityLookupOptions,
    campaignActivityOptions,
    campaignAuthoritySelectOptions,
    campaignEmirateSelectOptions,
    taskAttachments,
    taskModalMeta,
    syncedVisible,
    getTaskSubmitEnabled,
    setDuplicateTaskWarning,
    onSubmitted,
    t,
  });

  const taskSubmitButtonInactive = !taskSubmitEnabled || attachmentUploading || detailLoading;
  const taskSubmitButtonClassName = taskSubmitButtonInactive
    ? 'inspection-task-management__primary-button inspection-task-management__primary-button--visual-disabled'
    : 'inspection-task-management__primary-button';

  return (
    <>
      <Modal
        className="inspection-task-management__task-modal"
        title={isCreateLikeMode ? t('inspection.tasks.createTask') : t('inspection.tasks.editTeamTask')}
        visible={syncedVisible.value}
        centered
        forceRender
        onCancel={closeModal}
        footer={(
          <div className="inspection-task-management__modal-footer-actions">
            <Button className="inspection-task-management__outline-button" onClick={closeModal}>
              {t('inspection.common.cancel')}
            </Button>
            <Button
              className={taskSubmitButtonClassName}
              aria-disabled={taskSubmitButtonInactive}
              loading={detailLoading}
              onClick={handleTaskSubmit}
            >
              {isCreateLikeMode ? t('inspection.tasks.createTask') : t('inspection.common.save')}
            </Button>
          </div>
        )}
      >
        <SimpleBar autoHide className="inspection-task-management__task-modal-scroll">
          <div className="inspection-task-management__task-modal-scroll-content">
        <Form form={form} layout="vertical" className="inspection-task-management__task-form" onValuesChange={handleTaskFormValuesChange}>
          <Form.Item name="establishmentSubTypeId" hidden>
            <Input />
          </Form.Item>
          <TaskInfoFields
            reasonDropdownOpen={reasonDropdownOpen}
            reasonSearchKeyword={reasonSearchKeyword}
            filteredReasonOptions={filteredReasonOptions}
            prioritySelectOptions={prioritySelectOptions}
            onReasonDropdownVisibleChange={handleReasonDropdownVisibleChange}
            onReasonSearchChange={handleReasonSearchChange}
            onReasonSearchClear={handleReasonSearchClear}
            onReasonSelect={handleReasonSelect}
          />

          <InspectionTaskModalSections
            showTargetTypeSwitch={!isCampaignCreateMode}
            targetTypeContent={(
              <TargetFields
                isCampaignCreateMode={isCampaignCreateMode}
                currentTargetType={currentTargetType}
                taskModalMeta={taskModalMeta}
                targetSearchOptions={targetSearchOptions}
                targetSearchLoading={targetSearchLoading}
                isReadonlyTarget={isReadonlyTarget}
                isLicenseExemptSubtype={isLicenseExemptSubtype}
                shouldShowRegion={shouldShowRegion}
                establishmentSubtypeSelectOptions={establishmentSubtypeSelectOptions}
                emirateSelectOptions={emirateSelectOptions}
                authoritySelectOptions={authoritySelectOptions}
                regionSelectOptions={regionSelectOptions}
                communitySelectOptions={communitySelectOptions}
                campaignEmirateSelectOptions={campaignEmirateSelectOptions}
                campaignAuthoritySelectOptions={campaignAuthoritySelectOptions}
                campaignActivityOptions={campaignActivityOptions}
                campaignEmirateId={campaignEmirateId}
                authorityLookupLoading={authorityLookupLoading}
                campaignActivityLoading={campaignActivityLoading}
                onTargetSearch={handleTargetSearch}
                onTargetSelect={handleTargetSelect}
                onTargetFocus={handleTargetFocus}
                onTargetClear={handleTargetClear}
                onManualTargetStart={handleManualTargetStart}
              />
            )}
            executionTimelineContent={(
              <ExecutionFields
                isCampaignCreateMode={isCampaignCreateMode}
                isInspectorSelfCreate={isInspectorSelfCreate}
                inspectorOptionsLoading={inspectorOptionsLoading}
                inspectionMethodSelectOptions={inspectionMethodSelectOptions}
                resolvedInspectorOptions={resolvedInspectorOptions}
                taskAttachments={taskAttachments}
                onTaskAttachmentsChange={setTaskAttachments}
                onAttachmentUploadingChange={setAttachmentUploading}
              />
            )}
          />
        </Form>
          </div>
        </SimpleBar>
      </Modal>
      <DuplicateTaskWarningModal
        visible={duplicateTaskWarning.visible}
        title={t('inspection.tasks.messages.duplicateWarningTitle')}
        message={duplicateTaskWarning.message}
        cancelText={t('inspection.common.no')}
        confirmText={t('inspection.common.continue')}
        confirmLoading={duplicateTaskWarning.loading}
        onCancel={closeDuplicateTaskWarning}
        onConfirm={confirmDuplicateTaskWarning}
      />
    </>
  );
};

export default InspectionTaskModal;
