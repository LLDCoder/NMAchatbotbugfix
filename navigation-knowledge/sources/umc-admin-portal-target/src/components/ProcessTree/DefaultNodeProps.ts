import type { IApprovalNodeProps } from '@/components/ProcessTree';
import i18n from '@/localization/config';
import {
  DEFAULT_APPROVE_ACTION,
  DEFAULT_REJECT_ACTION,
} from '@/constants/workflowActions';

export const APPROVAL_PROPS: IApprovalNodeProps = {
  nodeId: '',
  nodeType: '',
  nodeNameEn: i18n.t("node.approval.name", { lng: "en" }),
  nodeNameAr: i18n.t("node.approval.name", { lng: "ar" }),
  nodeOrder: 0,
  assignee: '',
  approvalRole: '',
  slaType: '',
  slaTime: 0,
  candidateGroupsJson: '',
  formKey: '',
  conditionExpression:  '',
  propertiesJson: JSON.stringify({
    approve: DEFAULT_APPROVE_ACTION,
    reject: DEFAULT_REJECT_ACTION,
    externalApproval: false,
    requestModification: false,
    sendBack: false
  }),
  createdOn: null,
  updatedOn: null,
  nodeDescription: '',
  isSkip: false
}

export const ROOT_PROPS = {
  assignedUser: [],
  formPerms:[]
}

export const CONDITION_PROPS = {
  groupsType:"OR",
  groups:[
    {
      groupType:"AND",
      cids:[], 
      conditions:[]
    }
  ],
  expression: "" 
}

export const CC_PROPS = {
  shouldAdd: false,
  assignedUser: [],
  formPerms:[]
}

export const TRIGGER_PROPS = {
  type: 'WEBHOOK',
  http:{
    method: 'GET', 
    url: '', 
    headers: [
      {
        name: '',
        isField: true,
        value: '' 
      }
    ],
    contentType: 'FORM',
    params:[
      {
        name: '',
        isField: true, 
        value: ''
      }
    ],
    retry: 1,
    handlerByScript: false,
    success: 'function handlerOk(res) {\n  return true;\n}',
    fail: 'function handlerFail(res) {\n  return true;\n}'
  },
  email:{
    subject: '',
    to: [],
    content: ''
  }
}

export const DELAY_PROPS = {
  type: "FIXED",
  time: 0,
  unit: "M",
  dateTime: ""
}

export default {
  APPROVAL_PROPS, CC_PROPS, DELAY_PROPS, CONDITION_PROPS, ROOT_PROPS, TRIGGER_PROPS
}
