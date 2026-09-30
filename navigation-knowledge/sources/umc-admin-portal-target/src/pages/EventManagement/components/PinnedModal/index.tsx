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
import type { InputRef } from "antd/lib/input";
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
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinnedList, setPinnedList] = useState<IPinnedNewsItem[]>([]);
  const pinnedListRef = useRef<IPinnedNewsItem[]>([]);
  const [form] = Form.useForm();
  const [searchValue, setSearchValue] = useState("");
  const [filteredList, setFilteredList] = useState<IPinnedNewsItem[]>([]);
  const [selectOpen, setSelectOpen] = useState(false);
  const searchInputRef = useRef<InputRef>(null);
  const setTable = (data: IPinnedNewsItem) => {
    setPinnedList((prev) => {
      const newList = [...prev, data];
      pinnedListRef.current = newList;
      return newList;
    });
  };
  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
  }));

  const debouncedUnPinListRef = useRef(
    debounce((keyword: string) => {
      getUnPinList(keyword).then((res) => {
        const pinnedIds = new Set(pinnedListRef.current.map((item) => item.id));
        setFilteredList((res.data || []).filter((item) => !pinnedIds.has(item.id)));
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
      const pinnedIds = new Set(pinnedListRef.current.map((item) => item.id));
      setFilteredList((res.data || []).filter((item) => !pinnedIds.has(item.id)&&item.status==="3"));
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
    UnpinNew(id).then(() => {
      setPinnedList((prev) => {
        const newList = prev.filter((item) => item.id !== id);
        pinnedListRef.current = newList;
        return newList;
      });
    });
  };
  const onSubmit = async () => {
    form
      .validateFields()
      .then(async () => {
        if (pinnedList.length == 0) {
          setLoading(false);
          handleClose();
        } else {
          SavePinNew(
            pinnedList.map((item, index) => {
              return {
                id: item.id,
                sort: index,
              };
            })
          ).then(() => {
            setLoading(true);
            onOkCb?.();
            setLoading(false);
            handleClose();
          });
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    if (visible) {
      getPinnedList();
      UnPinList();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      debouncedUnPinListRef.current.cancel();
      debouncedGetPinnedListRef.current.cancel();
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    onCloseCb?.();
  };

  return (
    <Modal
      centered
      title={t("CMS.eventManagement.modals.managePinnedEvents.title")}
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
          tooltip={t("CMS.eventManagement.modals.managePinnedEvents.tooltip")}
          label={
            <span className="addtopinned">
              {t("CMS.eventManagement.modals.managePinnedEvents.addToPinned")}
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
            placeholder={t("CMS.eventManagement.modals.managePinnedEvents.searchOrSelect")}
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
                    <p>{item.titleEn}</p>
                    <p>{item.newsNo}</p>
                  </div>
                  <div
                    className="Pinnedbtn"
                    onClick={() => {
                      setSelectOpen(false);
                      setTable(item);
                    }}
                  >
                    {t("CMS.eventManagement.modals.managePinnedEvents.pin")}
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
