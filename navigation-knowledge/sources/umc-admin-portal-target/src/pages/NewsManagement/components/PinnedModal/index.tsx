import Sousuo from "@/assets/icons/Sousuo";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useRef,
} from "react";
import type { IPinnedModalRef, IProps } from "./type";
import { Form, Modal, Select, Input } from "antd";
import { UpOutlined, DownOutlined } from "@ant-design/icons";
import { CustomButton } from "@/components/common";
import {
  getPinList,
  type IPinnedNewsItem,
  getUnPinList,
  SavePinNew,
  UnpinNew,
} from "@/services/cms";
import { debounce } from "lodash";
import { PinnedTable } from "./PinnedTable";
import "./index.less";
import { useTranslation } from "react-i18next";

const { Option } = Select;

export const PinnedModal = forwardRef<IPinnedModalRef, IProps>((props, ref) => {
  const { onOkCb, onCloseCb } = props;
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinnedList, setPinnedList] = useState<IPinnedNewsItem[]>([]);
  const [removeId, setRemoveId] = useState<any[]>([]);
  const pinnedListRef = useRef<IPinnedNewsItem[]>([]);
  const removedItemsRef = useRef<IPinnedNewsItem[]>([]);
  const [form] = Form.useForm();
  const [searchValue, setSearchValue] = useState("");
  const [filteredList, setFilteredList] = useState<IPinnedNewsItem[]>([]);
  const [selectOpen, setSelectOpen] = useState(false);
  const searchInputRef = useRef<any>(null);
  const setTable = (data: IPinnedNewsItem) => {
    removedItemsRef.current = removedItemsRef.current.filter(
      (item) => item.id !== data.id
    );
    setRemoveId((prev) => prev.filter((rid) => rid !== data.id));
    setPinnedList((prev) => {
      const newList = [...prev, data];
      pinnedListRef.current = newList;
      return newList;
    });
  };

  // The unpin list comes from the server, where items removed in this session
  // are still pinned, so it never returns them. Merge those removed items back
  // in (matching the keyword) so they stay searchable and can be re-pinned.
  const mergeUnpinResults = (
    resData: IPinnedNewsItem[],
    keyword: string
  ): IPinnedNewsItem[] => {
    const pinnedIds = new Set(pinnedListRef.current.map((item) => item.id));
    const base = (resData || []).filter(
      (item) => !pinnedIds.has(item.id) && item.status === "3"
    );
    const seen = new Set(base.map((item) => item.id));
    const kw = (keyword || "").toLowerCase();
    const removedMatches = removedItemsRef.current.filter(
      (item) =>
        !pinnedIds.has(item.id) &&
        item.status === "3" &&
        !seen.has(item.id) &&
        (!kw ||
          (item.titleEn || "").toLowerCase().includes(kw) ||
          (item.titleAr || "").toLowerCase().includes(kw) ||
          (item.newsNo || "").toLowerCase().includes(kw))
    );
    return [...base, ...removedMatches];
  };
  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }));

  const debouncedUnPinListRef = useRef(
    debounce((keyword: string) => {
      getUnPinList(keyword).then((res) => {
        setFilteredList(mergeUnpinResults(res.data || [], keyword));
      });
    }, 500)
  );

  const debouncedGetPinnedListRef = useRef(
    debounce(async (keyword: string = "") => {
      const res = await getPinList(keyword);
      const data = res.data || [];
      const sortedData = [...data].sort((a, b) => {
        const sortA = a.sort ?? 0;
        const sortB = b.sort ?? 0;
        return sortA - sortB;
      });
      pinnedListRef.current = sortedData;
      setPinnedList(sortedData);
    }, 500)
  );

  const UnPinList = (keyword: string = "") => {
    getUnPinList(keyword).then((res) => {
      setFilteredList(mergeUnpinResults(res.data || [], keyword));
    });
  };

  const getPinnedList = async (keyword: string = "") => {
    const res = await getPinList(keyword);
    const data = res.data || [];
    const sortedData = [...data].sort((a, b) => {
      const sortA = a.sort ?? 0;
      const sortB = b.sort ?? 0;
      return sortA - sortB;
    });
    pinnedListRef.current = sortedData;
    setPinnedList(sortedData);
  };

  useEffect(() => {
    if (selectOpen) {
      UnPinList();
    }
  }, [selectOpen]);

  useEffect(() => {
    if (selectOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [selectOpen]);

  useEffect(() => {
    return () => {
      debouncedUnPinListRef.current.cancel();
      debouncedGetPinnedListRef.current.cancel();
    };
  }, []);
  const Remove = (id: number) => {
    if (!removeId.includes(id)) {
      setRemoveId([...removeId, id]);
    }
    const removed = pinnedListRef.current.find((item) => item.id === id);
    if (removed && !removedItemsRef.current.some((item) => item.id === id)) {
      removedItemsRef.current = [...removedItemsRef.current, removed];
    }
    setPinnedList((prev) => {
      const newList = prev.filter((item) => item.id !== id);
      pinnedListRef.current = newList;
      return newList;
    });
  };
  const onSubmit = async () => {
    try {
      await form.validateFields();
    } catch (err) {
      console.error(err);
      return;
    }
    setLoading(true);
    try {
      // Unpin items that were removed (originally pinned, now taken out).
      // Runs even when the list is cleared to empty, so "remove all" persists.
      const pinnedListIds = pinnedList.map((item) => item.id);
      const toUnpin = removeId.filter((id) => !pinnedListIds.includes(id));
      await Promise.all(toUnpin.map((id) => UnpinNew(id)));
      setRemoveId([]);
      // Save the new order for the remaining pinned items.
      if (pinnedList.length > 0) {
        await SavePinNew(
          pinnedList.map((item, index) => ({ id: item.id, sort: index }))
        );
      }
      onOkCb?.();
      handleClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      removedItemsRef.current = [];
      setRemoveId([]);
      getPinnedList();
      UnPinList();
    }
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    onCloseCb?.();
  };

  return (
    <Modal
      centered
      title={t("CMS.newsManagement.modals.managePinnedNews.title")}
      visible={visible}
      destroyOnClose
      className="Pinned-News-form-modal"
      onCancel={handleClose}
      footer={
        <div>
          <CustomButton
            text={t("CMS.common.cancel")}
            variant="outline"
            onClick={handleClose}
          />
          <CustomButton
            loading={loading}
            text={t("CMS.common.save")}
            variant="primary"
            onClick={onSubmit}
          />
        </div>
      }
    >
      <Form form={form} layout="vertical" className="custom-form">
        <Form.Item
          name="AddtoPinned"
          tooltip={t("CMS.newsManagement.modals.managePinnedNews.tooltip")}
          label={
            <span className="addtopinned">
              {t("CMS.newsManagement.modals.managePinnedNews.addToPinned")}
            </span>
          }
        >
          <Select
            disabled={pinnedList.length == 5}
            open={selectOpen}
            onDropdownVisibleChange={(open) => {
              setSelectOpen(open);
              if (!open) {
                setSearchValue("");
              }
            }}
            placeholder={t("CMS.newsManagement.modals.managePinnedNews.searchOrSelect")}
            className="select-reason umc-select-arrow-manual"
            suffixIcon={selectOpen ? <UpOutlined /> : <DownOutlined />}
            dropdownRender={(menu) => (
              <div>
                <div className="select-search-wrapper">
                  <Input
                    ref={searchInputRef}
                    prefix={<Sousuo className="search-icon" />}
                    placeholder={t("common.search")}
                    value={searchValue}
                    onChange={(e) => {
                      e.stopPropagation();
                      const value = e.target.value;
                      setSearchValue(value);
                      debouncedUnPinListRef.current(value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="select-search-input"
                  />
                </div>
                <div className="select-options-wrapper">{menu}</div>
              </div>
            )}
            filterOption={false}
          >
            {filteredList.map((item) => (
              <Option key={item.id} value={item.id}>
                <div
                  className="PinnedItem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="PinnedText">
                    <p>{i18n.resolvedLanguage === "ar" ? item.titleAr : item.titleEn}</p>
                    <p>{item.newsNo}</p>
                  </div>
                  <div
                    className="Pinnedbtn"
                    onClick={() => {
                      setSelectOpen(false);
                      setTable(item);
                    }}
                  >
                    {t("CMS.newsManagement.modals.managePinnedNews.pin")}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
      <PinnedTable
        data={pinnedList}
        Remove={Remove}
        onSortChange={(sortedData) => {
          pinnedListRef.current = sortedData;
          setPinnedList(sortedData);
        }}
      />
    </Modal>
  );
});
