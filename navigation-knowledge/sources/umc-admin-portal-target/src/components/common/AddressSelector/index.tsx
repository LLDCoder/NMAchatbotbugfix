import React, { useState, useEffect, useCallback } from "react";
import { Select, Row, Col } from "antd";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/address";
import "./index.less";

const { Option } = Select;

export interface AddressSelectorValue {
  emirate?: number;
  region?: number;
  area?: number;
}

export interface AddressSelectorProps {
  value?: AddressSelectorValue;
  onChange?: (value: AddressSelectorValue) => void;
  disabled?: boolean;
  placeholder?: {
    emirate?: string;
    region?: string;
    area?: string;
  };
  labels?: {
    emirate?: string;
    region?: string;
    area?: string;
  };
  required?: {
    emirate?: boolean;
    region?: boolean;
    area?: boolean;
  };
  layout?: "horizontal" | "vertical";
  colSpan?: {
    emirate?: number;
    region?: number;
    area?: number;
  };
}

const AddressSelector: React.FC<AddressSelectorProps> = ({
  value = {},
  onChange,
  disabled = false,
  placeholder = {
    emirate: "Select Emirate",
    region: "Select Region",
    area: "Select Area",
  },
  labels = {
    emirate: "Emirate",
    region: "Region",
    area: "Area",
  },
  required = {
    emirate: true,
    region: true,
    area: true,
  },
  layout = "horizontal",
  colSpan = {
    emirate: 8,
    region: 8,
    area: 8,
  },
}) => {
  const [emirateList, setEmirateList] = useState<EmirateItem[]>([]);
  const [allRegionList, setAllRegionList] = useState<RegionItem[]>([]);
  const [allAreaList, setAllAreaList] = useState<AreaItem[]>([]);
  const [filteredRegionList, setFilteredRegionList] = useState<RegionItem[]>([]);
  const [filteredAreaList, setFilteredAreaList] = useState<AreaItem[]>([]);
  const [loading, setLoading] = useState({
    emirate: false,
    region: false,
    area: false,
  });

  // Load all data on component mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(prev => ({ ...prev, emirate: true, region: true, area: true }));
        
        const [emirateResponse, regionResponse, areaResponse] = await Promise.all([
          getEmirateList(),
          getRegionList(),
          getAreaList(),
        ]);

        if (emirateResponse.data) {
          setEmirateList(emirateResponse.data);
        }

        if (regionResponse.data) {
          setAllRegionList(regionResponse.data);
        }

        if (areaResponse.data) {
          setAllAreaList(areaResponse.data);
        }
      } catch (error) {
        console.error("Failed to load address data:", error);
      } finally {
        setLoading({ emirate: false, region: false, area: false });
      }
    };

    loadAllData();
  }, []);

  // Filter regions based on selected emirate
  useEffect(() => {
    if (value.emirate && allRegionList.length > 0) {
      const filteredRegions = allRegionList.filter(
        (region) => region.emirateId === value.emirate
      );
      setFilteredRegionList(filteredRegions);
    } else {
      setFilteredRegionList([]);
    }
  }, [value.emirate, allRegionList]);

  // Filter areas based on selected region
  useEffect(() => {
    if (value.region && allAreaList.length > 0) {
      const filteredAreas = allAreaList.filter(
        (area) => area.regionId === value.region
      );
      setFilteredAreaList(filteredAreas);
    } else {
      setFilteredAreaList([]);
    }
  }, [value.region, allAreaList]);

  const handleEmirateChange = useCallback((emirateId: number) => {
    const newValue = {
      emirate: emirateId,
      region: undefined,
      area: undefined,
    };
    onChange?.(newValue);
  }, [onChange]);

  const handleRegionChange = useCallback((regionId: number) => {
    const newValue = {
      ...value,
      region: regionId,
      area: undefined,
    };
    onChange?.(newValue);
  }, [value, onChange]);

  const handleAreaChange = useCallback((areaId: number) => {
    const newValue = {
      ...value,
      area: areaId,
    };
    onChange?.(newValue);
  }, [value, onChange]);

  const renderSelect = (
    type: 'emirate' | 'region' | 'area',
    options: any[],
    handleChange: (value: number) => void,
    currentValue?: number
  ) => (
    <div className="address-selector-item">
      {layout === 'vertical' && labels[type] && (
        <label className="address-selector-label">
          {labels[type]}
          {required[type] && <span className="required-mark"> *</span>}
        </label>
      )}
      <Select
      className="umc-select-arrow-manual"
        placeholder={placeholder[type]}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled || (type !== 'emirate' && options.length === 0)}
        loading={loading[type]}
        showSearch
        optionFilterProp="children"
        filterOption={(input, option) =>
          (option?.children as unknown as string)
            ?.toLowerCase()
            .includes(input.toLowerCase())
        }
        style={{ width: "100%" }}
      >
        {options.map((option) => (
          <Option key={option.id} value={option.id}>
            {option.nameEn}
          </Option>
        ))}
      </Select>
    </div>
  );

  if (layout === 'vertical') {
    return (
      <div className="address-selector vertical">
        {renderSelect('emirate', emirateList, handleEmirateChange, value.emirate)}
        {renderSelect('region', filteredRegionList, handleRegionChange, value.region)}
        {renderSelect('area', filteredAreaList, handleAreaChange, value.area)}
      </div>
    );
  }

  return (
    <div className="address-selector horizontal">
      <Row gutter={16}>
        <Col span={colSpan.emirate}>
          {renderSelect('emirate', emirateList, handleEmirateChange, value.emirate)}
        </Col>
        <Col span={colSpan.region}>
          {renderSelect('region', filteredRegionList, handleRegionChange, value.region)}
        </Col>
        <Col span={colSpan.area}>
          {renderSelect('area', filteredAreaList, handleAreaChange, value.area)}
        </Col>
      </Row>
    </div>
  );
};

export default AddressSelector;