import {
  Form,
  Row,
  Col,
  Button,
  Switch,
  Input,
  Popover,
  Checkbox,
  Select,
} from "antd";
import { Button as MantineButton } from "@mantine/core";
import type { INode, IGroup } from "@/components/ProcessTree";
import Plus from "@/assets/icons/Plus";
import Delete from "@/assets/icons/Delete";
import { useTranslation } from "react-i18next";

interface IConditionNodeConfigProps {
  onProceessChange: (process: INode) => void;
  selectNode: INode;
  process: INode;
  formItems: any[];
}
const supportTypes = ["Number", "String", "Date", "Dept", "User"];
const groupNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
function filterCondition(item: any, list: any[]) {
  if (item.name === "SpanLayout") {
    item.props.items.forEach((sub: any) => filterCondition(sub, list));
  } else if (supportTypes.indexOf(item.valueType) > -1 && item.props.required) {
    list.push({ title: item.title, id: item.id, valueType: item.valueType });
  }
}
const explains = [
  { labelKey: "workflow.nodeConfig.conditionOperators.equal", value: "=" },
  { labelKey: "workflow.nodeConfig.conditionOperators.greaterThan", value: ">" },
  { labelKey: "workflow.nodeConfig.conditionOperators.greaterThanOrEqual", value: ">=" },
  { labelKey: "workflow.nodeConfig.conditionOperators.lessThan", value: "<" },
  { labelKey: "workflow.nodeConfig.conditionOperators.lessThanOrEqual", value: "<=" },
  { labelKey: "workflow.nodeConfig.conditionOperators.in", value: "IN" },
  { labelKey: "workflow.nodeConfig.conditionOperators.betweenOpen", value: "B" },
  { labelKey: "workflow.nodeConfig.conditionOperators.betweenLeftClosed", value: "AB" },
  { labelKey: "workflow.nodeConfig.conditionOperators.betweenRightClosed", value: "BA" },
  { labelKey: "workflow.nodeConfig.conditionOperators.betweenClosed", value: "ABA" },
];
const conditionOperatorLabelKeys: Record<string, string> = {
  "=": "workflow.nodeConfig.conditionOperators.equal",
  ">": "workflow.nodeConfig.conditionOperators.greaterThan",
  ">=": "workflow.nodeConfig.conditionOperators.greaterThanOrEqual",
  "<": "workflow.nodeConfig.conditionOperators.lessThan",
  "<=": "workflow.nodeConfig.conditionOperators.lessThanOrEqual",
  IN: "workflow.nodeConfig.conditionOperators.in",
  B: "workflow.nodeConfig.conditionOperators.betweenOpen",
  AB: "workflow.nodeConfig.conditionOperators.betweenLeftClosed",
  BA: "workflow.nodeConfig.conditionOperators.betweenRightClosed",
  ABA: "workflow.nodeConfig.conditionOperators.betweenClosed",
};
export default function ConditionNodeConfig({
  formItems,
  onProceessChange,
  selectNode,
  process,
}: IConditionNodeConfigProps) {
  const { t } = useTranslation();
  const config = selectNode.props;
  const groups = (config?.groups || []) as IGroup[];
  const numberOperatorOptions = explains.map((item) => ({
    label: t(conditionOperatorLabelKeys[item.value]),
    value: item.value,
  }));
  const basicOperatorOptions = [
    { label: t("workflow.nodeConfig.conditionOperators.equal"), value: "=" },
    { label: t("workflow.nodeConfig.conditionOperators.in"), value: "IN" },
  ];
  function conditionList() {
    const conditionItems: any[] = [];
    formItems?.forEach((item) => filterCondition(item, conditionItems));
    if (conditionItems.length === 0 || conditionItems[0].id !== "root") {
      conditionItems.unshift({
        id: "root",
        title: t("node.initiator.name"),
        valueType: "User",
      });
    }
    return conditionItems;
  }
  function itemToMap(map: Map<string, any>, item: any) {
    map.set(item.id, item);
    if (item.name === "SpanLayout") {
      item.props.items.forEach((sub: any) => itemToMap(map, sub));
    }
  }
  function getFormMap() {
    const map = new Map();
    formItems.forEach((item) => itemToMap(map, item));
    return map;
  }
  function isSelect(formId: string) {
    const form = getFormMap().get(formId);
    if (
      form &&
      (form.name === "SelectInput" || form.name === "MultipleSelect")
    ) {
      return true;
    }
    return false;
  }
  function getOptions(formId: string) {
    return getFormMap().get(formId)?.props?.options || [];
  }
  function conditionValType(type: string) {
    switch (type) {
      case "=":
      case ">":
      case ">=":
      case "<":
      case "<=":
        return 0;
      case "IN":
        return 1;
      default:
        return 2;
    }
  }
  function selectUser() {}
  function rmSubCondition(group: IGroup, index: number) {
    group.cids.splice(index, 1);
    group.conditions.splice(index, 1);
    onProceessChange({ ...process });
  }
  return (
    <Form className="condition-from" labelCol={{ span: 12 }}>
      <Row>
        <Col span={12}>
          <Form.Item label={t("workflow.nodeConfig.adjustPriority")}>
            <Button>{t("workflow.nodeConfig.no2Level")}</Button>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            className="conditiona-group-relationship"
            label={t("workflow.nodeConfig.conditionalGroupRelationship")}
          >
            <span
              className={
                config?.groupsType === "OR"
                  ? "conditiona-group-label-active"
                  : ""
              }
            >
              {t("workflow.nodeConfig.or")}
            </span>{" "}
            <Switch
              checked={config?.groupsType === "AND"}
              onChange={(flag) => {
                if (config?.groupsType) {
                  config.groupsType = flag ? "AND" : "OR";
                }
                onProceessChange({ ...process });
              }}
            />{" "}
            <span
              className={
                config?.groupsType === "AND"
                  ? "conditiona-group-label-active"
                  : ""
              }
            >
              {t("workflow.nodeConfig.and")}
            </span>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={t("workflow.nodeConfig.conditionalGroupExpression")}></Form.Item>
        </Col>
        <Input
          value={config?.expression}
          onChange={(e) => {
            if (config?.expression) {
              config.expression = e.target.value;
              onProceessChange({ ...process });
            }
          }}
          placeholder={t("workflow.nodeConfig.conditionExpressionPlaceholder")}
        />
        <span>{t("workflow.nodeConfig.conditionExpressionTip")}</span>
        <div className="add-condition-group">
          <MantineButton className="plus-btn mt15">
            <div className="plus-btn">
              <Plus />
              <span>{t("workflow.nodeConfig.addConditionGroup")}</span>
            </div>
          </MantineButton>
          <span>{t("workflow.nodeConfig.mandatoryCriteriaTip")}</span>
        </div>
      </Row>
      {groups.map((item, index) => {
        return (
          <div key={`${index}_g`} className="group mt15">
            <div className="group-header">
              <span className="group-name">{t("workflow.nodeConfig.conditionGroup", { name: groupNames[index] })}</span>
              <div className="group-cp">
                {t("workflow.nodeConfig.withinGroupRelationship")}
                <span
                  className={
                    item?.groupType === "OR"
                      ? "conditiona-group-label-active"
                      : ""
                  }
                >
                  {t("workflow.nodeConfig.or")}
                </span>{" "}
                <Switch
                  checked={item?.groupType === "AND"}
                  onChange={(flag) => {
                    item.groupType = flag ? "AND" : "OR";
                    onProceessChange({ ...process });
                  }}
                />{" "}
                <span
                  className={
                    config?.groupsType === "AND"
                      ? "conditiona-group-label-active"
                      : ""
                  }
                >
                  {t("workflow.nodeConfig.and")}
                </span>
              </div>
              <div className="group-operation">
                <Popover
                  title={t("workflow.nodeConfig.selectApprovalCriteria")}
                  trigger="click"
                  content={
                    <Checkbox.Group
                      options={conditionList().map((condition) => {
                        return { label: condition.title, value: condition.id };
                      })}
                      onChange={(values) => {
                        if (item?.cids) {
                          item.cids = values as string[];
                          onProceessChange({ ...process });
                        }
                      }}
                    />
                  }
                >
                  <div>
                    <Plus className="header-plus-btn" />
                  </div>
                </Popover>
                <Delete className="header-delete-btn" />
              </div>
            </div>
            <div className="group-content">
              {item?.conditions?.length === 0 && (
                <p>
                  {t("workflow.nodeConfig.emptyConditionGroup")}
                </p>
              )}
              {item?.conditions?.length > 0 && (
                <div>
                  {item.conditions.map((condition, cindex) => (
                    <div>
                      <div>{condition.title}</div>
                      {condition.valueType === "String" && (
                        <span>
                          <Select
                            onChange={(value) => {
                              if (condition.compare) {
                                condition.compare = value;
                                condition.value = [];
                                onProceessChange({ ...process });
                              }
                            }}
                            placeholder={t("workflow.nodeConfig.operator")}
                            options={basicOperatorOptions}
                          />
                          {isSelect(condition.id) && (
                            <span>
                              {condition.compare === "IN" && (
                                <Select
                                  mode="multiple"
                                  allowClear
                                  placeholder={t("workflow.nodeConfig.selectValue")}
                                  options={getOptions(condition.id).map(
                                    (opt: any) => {
                                      return { label: opt, value: opt };
                                    }
                                  )}
                                  value={condition.value}
                                  onChange={(value) => {
                                    condition.value = value;
                                    onProceessChange({ ...process });
                                  }}
                                />
                              )}
                              {condition.compare !== "IN" && (
                                <Select
                                  allowClear
                                  placeholder={t("workflow.nodeConfig.selectValue")}
                                  options={getOptions(condition.id).map(
                                    (opt: any) => {
                                      return { label: opt, value: opt };
                                    }
                                  )}
                                  value={condition.value[0].name}
                                  onChange={(value: string) => {
                                    condition.value[0].name = value;
                                    onProceessChange({ ...process });
                                  }}
                                />
                              )}
                            </span>
                          )}
                          {!isSelect(condition.id) && (
                            <span>
                              {condition.compare === "=" && (
                                <Input
                                  placeholder={t("workflow.nodeConfig.enterComparisonValue")}
                                  value={condition.value[0].name}
                                  onChange={(e) => {
                                    condition.value[0].name = e.target.value;
                                    onProceessChange({ ...process });
                                  }}
                                />
                              )}
                            </span>
                          )}
                        </span>
                      )}
                      {condition.valueType === "Number" && (
                        <span>
                          <Select
                            placeholder={t("workflow.nodeConfig.operator")}
                            options={numberOperatorOptions}
                            value={condition.compare}
                            onChange={(value) => {
                              condition.compare = value;
                              onProceessChange({ ...process });
                            }}
                          />
                          <span style={{ marginLeft: 10 }}>
                            {conditionValType(condition.compare) === 0 && (
                              <Input
                                placeholder={t("workflow.nodeConfig.enterComparisonValue")}
                                value={condition.value[0].name}
                                onChange={(e) => {
                                  condition.value[0].name = e.target.value;
                                  onProceessChange({ ...process });
                                }}
                              />
                            )}
                            {conditionValType(condition.compare) !== 0 &&
                              conditionValType(condition.compare) !== 1 && (
                                <span>
                                  <Input
                                    placeholder={t("workflow.nodeConfig.enterComparisonValue")}
                                    value={condition.value[0].name}
                                    onChange={(e) => {
                                      condition.value[0].name = e.target.value;
                                      onProceessChange({ ...process });
                                    }}
                                  />
                                  <span>
                                    ~
                                    <Input
                                      placeholder={t("workflow.nodeConfig.enterComparisonValue")}
                                      value={condition.value[1].name}
                                      onChange={(e) => {
                                        condition.value[1].name =
                                          e.target.value;
                                        onProceessChange({ ...process });
                                      }}
                                    />
                                  </span>
                                </span>
                              )}
                          </span>
                        </span>
                      )}
                      {condition.valueType === "User" && (
                        <span>
                          <span
                            className="item-desc"
                            style={{ marginRight: 20 }}
                          >
                            {t("workflow.nodeConfig.userConditionDescription")}
                          </span>
                          <MantineButton
                            className="plus-btn mt15"
                            onClick={() => selectUser()}
                          >
                            <div className="plus-btn">
                              <Plus />
                              <span>{t("workflow.nodeConfig.selectPersonnelDepartment")}</span>
                            </div>
                          </MantineButton>
                        </span>
                      )}
                      {condition.valueType === "Dept" && (
                        <span>
                          <span
                            className="item-desc"
                            style={{ marginRight: 20 }}
                          >
                            {t("workflow.nodeConfig.departmentConditionDescription")}
                          </span>
                          <MantineButton
                            className="plus-btn mt15"
                            onClick={() => selectUser()}
                          >
                            <div className="plus-btn">
                              <Plus />
                              <span>{t("workflow.nodeConfig.selectPersonnelDepartment")}</span>
                            </div>
                          </MantineButton>
                        </span>
                      )}
                      {condition.valueType === "Date" && (
                        <span>
                          <Delete
                            className="el-icon-delete"
                            onClick={() => rmSubCondition(item, cindex)}
                          />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Form>
  );
}
