// import "antd/dist/antd.less";
import { createForm, onFieldValueChange } from "@formily/core";
// import "./index.css";
import { request } from "@/services";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSchemaField } from "@formily/react";
import {
  Form,
  FormItem,
  DatePicker,
  Checkbox,
  Cascader,
  Editable,
  Input,
  NumberPicker,
  Switch,
  Password,
  PreviewText,
  Reset,
  Select,
  Space,
  Submit,
  TimePicker,
  Transfer,
  TreeSelect,
  // Upload,
  FormGrid,
  FormLayout,
  FormTab,
  FormCollapse,
  ArrayTable,
  ArrayCards,
  // Rate,
} from "@formily/antd";
import { Button } from "antd";
import { Radio, RadioGroupField } from "@/components/designable/src/components/Radio/preview";
import CountryDropdown from "@/components/designable/src/components/CountryDropdown/CountryDropdown";
import Address from "@/components/designable/src/components/Address/Address";
import AddressPicker from "@/components/designable/src/components/AddressPicker/AddressPicker";
import EquipmentList from "@/components/designable/src/components/EquipmentList/EquipmentList";
import Information from "@/components/designable/src/components/Information/Information";
import SelectTableField from "@/components/designable/src/components/SelectTable/SelectTableField";
import LanguageSelect from "@/components/designable/src/components/LanguageSelect/LanguageSelect";
import UploadDom from "@/components/designable/src/components/Upload/Upload";
import { DraftFileOrLinkField } from "@/components/designable/src/components/DraftFileOrLink/DraftFileOrLinkField";
import LanguageSelectMulti from "@/components/designable/src/components/LanguageSelectMulti/LanguageSelectMulti";
import IDSelectorField from "@/components/designable/src/components/IDSelector/IDSelectorField";
import { Card, Slider, Rate } from "antd";
import { PublicationFormField } from "@/components/designable/src/components/PublicationForm/PublicationFormField";

import { AcquaintanceFormField } from "@/components/designable/src/components/AcquaintanceForm/AcquaintanceFormField";
import { FilmingLocationsField } from "@/components/designable/src/components/AddressList/AddressList";
import { DataFormField } from "@/components/designable/src/components/DataForm/DataFormField";
import { BookListUploadField } from "@/components/designable/src/components/BookList/BookListUploadField";
import { FileUploadGridField } from "@/components/designable/src/components/FileUploadGrid/FileUploadGridField";
import UrlListField from "@/components/designable/src/components/UrlList/UrlList";
import PressCardSelectorField from "@/components/designable/src/components/PressCardSelector/PressCardSelector";
import { SocialMediaAccountField } from "@/components/designable/src/components/SocialMediaAccount/SocialMediaAccountField";
import { TradeLicenseDetailsField } from "@/components/designable/src/components/TradeLicenseDetails/TradeLicenseDetailsField";
import { GuardianConsentDetailsField } from "@/components/designable/src/components/GuardianConsentDetails/GuardianConsentDetailsField";
import { MoviePackageFormField } from "@/components/designable/src/components/MoviePackageForm/MoviePackageFormField";
import { NewpaperMagazineCirculationField } from "@/components/designable/src/components/NewpaperMagazineCirculation/NewpaperMagazineCirculationField";
import { BeneficiaryTypeField } from "@/components/designable/src/components/BeneficiaryType/BeneficiaryTypeField";
import PosterAndTrailerPermitField from "@/components/designable/src/components/PosterAndTrailerPermit/PosterAndTrailerPermitField";
import { ScriptPublicationFormField } from "@/components/designable/src/components/ScriptPublicationForm/ScriptPublicationFormField";
import DurationInput from "@/components/designable/src/components/DurationInput/DurationInput";
interface SchemaData {
  form: {
    labelCol: number;
    wrapperCol: number;
  };
  schema: object;
}
function Detail() {
  const { t } = useTranslation();
  const form = createForm({
    effects() {
      onFieldValueChange("equipmentList", (field) => {
        // field.display = 'none'
        // form.setFieldState("*", (state) => {
        //     console.log("setFieldState", state);
        // //   if (state.title === "select") {
        // //   }
        //   //   state.display = 'none';
        // });
      });
    },
  });
  // const schema = JSON.parse(localStorage.getItem("formily-schema") || "{}");
  const [schemaData, setSchemaData] = useState<SchemaData>({
    form: {
      labelCol: 4,
      wrapperCol: 14,
    },
    schema: {},
  });
  const SchemaField = createSchemaField({
    components: {
      Input,
      DurationInput,
      FormItem,
      DatePicker,
      Checkbox,
      Cascader,
      Editable,
      NumberPicker,
      Switch,
      Password,
      PreviewText,
      Radio,
      "Radio.Group": RadioGroupField,
      Reset,
      Select,
      Space,
      Submit,
      TimePicker,
      Transfer,
      TreeSelect,
      Upload: UploadDom,
      DraftFileOrLink: DraftFileOrLinkField,
      FormGrid,
      FormLayout,
      FormTab,
      FormCollapse,
      ArrayTable,
      ArrayCards,
      Card,
      Slider,
      Rate,
      CountryDropdown,
      Address,
      AddressPicker,
      EquipmentList,
      Information,
      SelectTable: SelectTableField,
      LanguageSelect,
      LanguageSelectMulti,
      IDSelector: IDSelectorField,
      AcquaintanceForm: AcquaintanceFormField,
      AddressList: FilmingLocationsField,
      DataForm: DataFormField,
      BookList: BookListUploadField,
      FileUploadGrid: FileUploadGridField,
      UrlList: UrlListField,
      PosterAndTrailerPermit: PosterAndTrailerPermitField,
      PressCardSelector: PressCardSelectorField,
      PublicationForm: PublicationFormField,
      SocialMediaAccount: SocialMediaAccountField,
      TradeLicenseDetails: TradeLicenseDetailsField,
      GuardianConsentDetails: GuardianConsentDetailsField,
      MoviePackageForm: MoviePackageFormField,
      NewpaperMagazineCirculation: NewpaperMagazineCirculationField,
      ScriptPublicationForm: ScriptPublicationFormField,
      BeneficiaryType: BeneficiaryTypeField,
    },
  });
  useEffect(() => {
    const Moss = JSON.parse(localStorage.getItem("formily-schema") || "{}");

    console.log(Moss);

    setSchemaData(Moss || "{}");
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.submit();
      console.log("Submit Success：", values);
    } catch (e) {
      console.log("Submit Failed（Required Validation Failed）", e);
    }
  };

  return (
    <div className="detail" style={{ overflowY: "auto", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "20px",
          marginTop: "20px",
          boxSizing: "border-box",
        }}
      ></div>
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px 0",
          boxSizing: "border-box",
        }}
        className="antformbody hide-scrollbar"
      >
        <Form
          form={form}
          className="custorm-form"
          labelCol={schemaData.form?.labelCol}
          wrapperCol={schemaData.form?.wrapperCol}
        >
          <SchemaField schema={schemaData.schema}></SchemaField>
        </Form>
        <div
          className="antformfooter"
          onClick={() => {
            form.submit();
          }}
        >
          {t("common.apply")}
        </div>
      </div>
    </div>
  );
}

export default Detail;
