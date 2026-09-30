import type { FormInstance } from "antd";

interface ISEOFieldType {
  emirateId: number;
  regionId: number;
  areaId: number;
  street: string;
  streetAr: string;
}

interface IProps {
  LocationForm: FormInstance<ISEOFieldType>;
}
interface ILocationValues {
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
  streetAr?: string;
}

interface ILocationRef {
  emirateName: string;
  emirateNameAr: string;
  regionName: string;
  regionNameAr: string;
  areaName: string;
  areaNameAr: string;
  streetName: string;
  streetNameAr: string;
  setLocationValues: (values: ILocationValues) => Promise<void>;
}

export type { IProps, ISEOFieldType, ILocationRef };
