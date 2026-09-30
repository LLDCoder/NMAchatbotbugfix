import React, { useEffect } from "react";
import { Space, Button, Radio } from "antd";
import { GithubOutlined } from "@ant-design/icons";
import { useDesigner, TextWidget } from "@designable/react";
import { GlobalRegistry } from "@designable/core";
import { observer } from "@formily/react";
import { loadInitialSchema, saveSchema, loadSchema } from "../service";
import { request } from "@/services";
// ... existing code ...
// Deleted:import { Link, useNavigate } from "react-router-dom";
import { useHistory } from "react-router-dom";
export const ActionsWidget = observer(() => {
  // Deleted:const navigate = useNavigate();
  const history = useHistory();
  const designer = useDesigner();
  useEffect(() => {
    loadInitialSchema(designer);
  }, []);
  const supportLocales = ["en-us", "ko-kr", "ar-ae"];
  useEffect(() => {
    if (!supportLocales.includes(GlobalRegistry.getDesignerLanguage())) {
      GlobalRegistry.setDesignerLanguage("en-us");
    }
  }, []);
  return (
    <Space style={{ marginRight: 10 }}>
      <Radio.Group
        value={GlobalRegistry.getDesignerLanguage()}
        optionType="button"
        options={[
          { label: "English", value: "en-us" },
          { label: "Arabic (UAE)", value: "ar-ae" },
          // { label: '한국어', value: 'ko-kr' },
        ]}
        onChange={(e) => {
          GlobalRegistry.setDesignerLanguage(e.target.value);
        }}
      />
      <Button
        onClick={() => {
          saveSchema(designer);
          request
            .post("/api/DyForms/SaveForm", {
              serviceId: "sID0002",
              title: "titleName",
              description: "test",
              formsData: loadSchema(designer),
            })
            .then((res) => {
              console.log(res);
            });
        }}
      >
        <TextWidget>Save</TextWidget>
      </Button>
      <Button
        type="primary"
        onClick={() => {
          saveSchema(designer);
        }}
      >
        <TextWidget>Publish</TextWidget>
      </Button>
      <Button
        type="primary"
        onClick={() => {
          console.log(loadSchema(designer));
          request
            .post("/api/DyForms/SaveForm", {
              serviceId: "sID0002",
              title: "titleName",
              description: "test",
              formsData: loadSchema(designer),
            })
            .then((res) => {
              console.log(res);
            });
        }}
      >
        <TextWidget>View</TextWidget>
      </Button>
    </Space>
  );
});
