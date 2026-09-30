import React, { useMemo } from 'react';
import { cloneDeep } from 'lodash';
import { Button } from '@mantine/core'
import { message } from 'antd'
import Root from './Root';
import Approval from './Approval';
import Cc from './Cc';
import Condition from './Condition';
import Empty from './Empty';
import DefaultNodeProps from './DefaultNodeProps';
import Concurrent from './Concurrent';
import Delay from './Delay';
import Trigger from './Trigger';
import ProcessEnd from './ProcessEnd';
import './index.css';
import { useTranslation } from 'react-i18next';

function getComponent(type: string): React.FC<any> | null{
    switch (type) {
        case 'Root':
            return Root;
        case 'Approval':
            return Approval;
        case 'Cc':
            return Cc;
        case 'Condition':
            return Condition;
        case 'Empty':
            return Empty;
        case 'Concurrent':
            return Concurrent;
        case 'Delay':
            return Delay;
        case 'Trigger':
            return Trigger;
        case 'Processend':
            return ProcessEnd;
    }
    return null;
}
type TCompare = 'IN' | 'B' | 'AB' | 'BA' | 'ABA' | '<=' | '>=' | '=';
export interface ICondition{
    valueType: 'Dept' | 'User' | 'Number' | 'String' | 'Date';
    title: string;
    value: {
        name: string;
    }[];
    id: string;
    compare: TCompare;
}
type TGroupsType = 'AND' | 'OR';
export interface IGroup{
    conditions: ICondition[];
    groupType: TGroupsType;
    cids: string[];
}

export interface IContext {
    nodeMap: Map<string, any>;
    diagramMode: string;
}
export const Context = React.createContext<IContext>({
    nodeMap: new Map(),
    diagramMode: 'design',
});
export interface IFormPerms{
    id: string;
    title: string;
    required: boolean;
    perm: 'E' | 'R';
};
export type TNodeType = 'NODE' | 'ROOT' | 'APPROVAL' | 'CC' | 'DELAY' | 'TRIGGER' | 'CONDITION' | 'CONCURRENT'| 'CONDITIONS' | 'CONCURRENTS' | 'EMPTY' | 'PROCESSEND';
export interface ILeaderTop{
    endCondition: 'TOP' | 'LEAVE';
    level?: number;
}
export interface INobody{
    handler: 'TO_PASS' | 'TO_REFUSE' | 'TO_ADMIN' | 'TO_USER';
}
export interface INodePropsHander{
    type: 'PASS' | 'REFUSE' | 'NOTIFY';
    notify: {
        once: boolean;
        hour?: number;
    }
}
export interface INodePropsRefuse{
    type: 'TO_END' | 'TO_BEFORE' | 'TO_NODE';
}
export type TAssignedType = 'ASSIGN_USER' | 'SELF_SELECT' | 'ROLE' | 'SELF';
export interface IGroups{
    groupType: TGroupsType;
    cids: string[];
    conditions: ICondition[]
}
export interface IApprovalNodeProps{
    id?: number;
    nodeId?: string;
    nodeType?: string;
    nodeNameEn?: string;
    nodeNameAr?: string;
    nodeOrder?: number;
    assignee?: string;
    approvalDepartment?: number;
    approvalRole?: string;
    slaType?: string;
    slaTime?: number;
    candidateGroupsJson?: string;
    formKey?: string;
    conditionExpression?: string;
    propertiesJson?: string;
    createdOn?: string | null;
    updatedOn?: string | null;
    nodeDescription?: string;
    isSkip?: boolean;
}
interface ICcNodeProps extends  IApprovalNodeProps{
    
}
interface IConditionNodeProps extends  IApprovalNodeProps{
    
}
interface IConcurrentNodeProps extends  IApprovalNodeProps{
   
}
export interface INodeProps{
    approval: IApprovalNodeProps;
    cc: ICcNodeProps;
    condition: IConditionNodeProps;
    concurrent: IConcurrentNodeProps;
}
export interface ITimeLimit{
    handler: INodePropsHander;
    timeout: {
        value: number
    }
}
export interface INode<T extends keyof INodeProps = any>{
    type?: TNodeType;
    id?: string;
    parentId?: string | null;
    children?: INode;
    name?: string;
    desc?: string;
    props?: INodeProps[T];
    branchs?: INode[];
    parent?: INode;
}


interface IProcessTreeProps{
    onSelected: (node: INode<keyof INodeProps> | null) => void,
    onProcessChange: (newProcess: INode<keyof INodeProps>) => void,
    process: INode<keyof INodeProps>,
    selectedNode: INode<keyof INodeProps> | null,
}
export function isBranchNode(node: INode<keyof INodeProps>){
    return node && (node.type === 'CONDITIONS' || node.type === 'CONCURRENTS');
}
function isConditionNode(node: INode<keyof INodeProps>){
    return node.type === 'CONDITIONS';
}
function  isEmptyNode(node: INode<keyof INodeProps>){
    return node && (node.type === 'EMPTY')
}
function isBranchSubNode(node: INode<keyof INodeProps>){
    return node && (node.type === 'CONDITION' || node.type === 'CONCURRENT');
}
export function getRandomId(){
    return `node_${new Date().getTime().toString().substring(5)}${Math.round(Math.random()*9000+1000)}`
}
function insertCoverLine(index: number, doms: React.ReactNode[], branchs: INode<keyof INodeProps>[]){
    if (index === 0){
        //Branch
        doms.unshift(React.createElement('div', {'className':'line-top-left'}));
        doms.unshift(React.createElement('div', {'className':'line-bot-left'}, []));
      }else if (index === branchs.length - 1){
        //Branch
        doms.unshift(React.createElement('div', {'className':'line-top-right'}));
        doms.unshift(React.createElement('div', {'className':'line-bot-right'}, []));
      }
}
function isPrimaryNode(node: INode<keyof INodeProps>){
    return node && (node.type === 'ROOT' || node.type === 'APPROVAL' || node.type === 'CC' || node.type === 'DELAY' || node.type === 'TRIGGER' || node.type === 'PROCESSEND');
}
export default function ProcessTree({ selectedNode, onSelected, process, onProcessChange }: IProcessTreeProps) {
    const { i18n, t } = useTranslation();
    
    const contextValue = useMemo(() => {
        const nodeMap = new Map<string, any>();
        
        return {
            nodeMap: nodeMap,
            diagramMode: 'design',
        };
    }, []);

    function insertNode(type: TNodeType, parentNode: INode<keyof INodeProps>){
        if(!parentNode) return ;
        let afterNode = parentNode.children
        parentNode.children = {
            id: getRandomId(),
            parent: parentNode,
            parentId: parentNode.id,
            props: {} as INodeProps[keyof INodeProps],
            type: type,
        }
        switch (type){
            case 'APPROVAL': insertApprovalNode(parentNode as INode<'approval'>); break;
            case 'CC': insertCcNode(parentNode); break;
            case 'DELAY': insertDelayNode(parentNode); break;
            case 'TRIGGER': insertTriggerNode(parentNode); break;
            case 'CONDITIONS': insertConditionsNode(parentNode); break;
            case 'CONCURRENTS': insertConcurrentsNode(parentNode); break;
            default: break;
        }
        if(isBranchNode({ type })){
            if (afterNode && afterNode.id){
                afterNode.parentId = parentNode.children.children?.id
                afterNode.parent = parentNode.children.children
            }
            if(parentNode?.children?.children){
                parentNode.children.children.children = afterNode;
            }
        } else {
             if (afterNode && afterNode.id && parentNode.children){
                afterNode.parentId = parentNode.children.id;
                afterNode.parent = parentNode.children;
            }
            if(parentNode.children){
                parentNode.children.children = afterNode;
            }
        }
        onProcessChange({ ...process });
    }

    function insertApprovalNode(parentNode: INode<'approval'>){
        if(parentNode && parentNode.children){
            parentNode.children.name = t("node.approval.name");
            parentNode.children.props = cloneDeep(DefaultNodeProps.APPROVAL_PROPS);
            parentNode.children.props.nodeNameEn = i18n.t("node.approval.name", { lng: "en" });
            parentNode.children.props.nodeNameAr = i18n.t("node.approval.name", { lng: "ar" });
        }
    }

    function insertCcNode(parentNode: INode<keyof INodeProps>){
        if(parentNode.children){
            parentNode.children.name = 'CC';
            parentNode.children.props = cloneDeep(DefaultNodeProps.CC_PROPS);
        }
    }

    function insertDelayNode(parentNode: INode<keyof INodeProps>){
        if(parentNode.children){
            parentNode.children.name = 'Delay processing';
            parentNode.children.props = cloneDeep(DefaultNodeProps.DELAY_PROPS);
        }
    }

    function insertTriggerNode(parentNode: INode<keyof INodeProps>){
        if(parentNode.children){ 
            parentNode.children.name = 'Trigger';
            parentNode.children.props = cloneDeep(DefaultNodeProps.TRIGGER_PROPS);

        }
    }

    function insertConditionsNode(parentNode: INode<keyof INodeProps>){
        if(parentNode.children){
            parentNode.children.name = 'Conditional branch';
            parentNode.children.children = {
                id: getRandomId(),
                parentId: parentNode.children.id,
                parent: parentNode.children,
                type: "EMPTY"
            }
            parentNode.children.branchs = [
                {
                    id: getRandomId(),
                    parentId: parentNode.children.id,
                    parent: parentNode.children,
                    type: "CONDITION",
                    props: cloneDeep(DefaultNodeProps.CONDITION_PROPS),  
                    name: "Condition 1",
                    children:{}
                },
                {
                    id: getRandomId(),
                    parentId: parentNode.children.id,
                    parent: parentNode.children,
                    type: "CONDITION",
                    props: cloneDeep(DefaultNodeProps.CONDITION_PROPS),
                    name: "Condition 2",
                    children:{}
                }
            ]
        }
    }

    function insertConcurrentsNode(parentNode: INode<keyof INodeProps>){
        if(parentNode.children){
            parentNode.children.name = "Parallel branch";
            parentNode.children.children ={
                id: getRandomId(),
                parentId: parentNode.children.id,
                type: "EMPTY"
            }
            parentNode.children.branchs = [
                {
                    id: getRandomId(),
                    name: "Branch1",
                    parentId: parentNode.children.id,
                    type: "CONCURRENT",
                    props: {} as INodeProps[keyof INodeProps],
                    children:{}
                },{
                    id: getRandomId(),
                    name: "Branch2",
                    parentId: parentNode.children.id,
                    type: "CONCURRENT",
                    props: {} as INodeProps[keyof INodeProps],
                    children:{}
                }
            ]
        }
    }

    function delNode(node: INode<keyof INodeProps>){
        const parentNode = contextValue.nodeMap.get(node.parentId || '');
        if (parentNode){
            if (isBranchNode(parentNode)){
                parentNode.branchs?.splice(parentNode.branchs.indexOf(node), 1)
                if (parentNode.branchs && parentNode.branchs?.length < 2 && parentNode.parentId){
                    const ppNode = contextValue.nodeMap.get(parentNode.parentId);
                    if (ppNode && parentNode.branchs[0].children && parentNode.branchs[0].children.id){
                        ppNode.children = parentNode.branchs[0].children;
                        ppNode.children.parentId = ppNode.id;
                        const endNode = getBranchEndNode(parentNode.branchs[0]);
                        endNode.children = parentNode?.children?.children;
                        if (endNode.children && endNode.children.id){
                            endNode.children.parentId = endNode.id;
                        }
                    }else {
                        if(ppNode){
                            ppNode.children = parentNode?.children?.children;
                            if (ppNode.children && ppNode.children.id){
                                ppNode.children.parentId = ppNode.id;
                            }
                        }
                    }
                }
            }else {
                if (node.children) {
                    node.children.parentId = parentNode.id;
                    node.children.parent = parentNode;
                }
                parentNode.children = node.children;
            }
            if(selectedNode?.id === node.id){
                onSelected(null);
            }
            onProcessChange({ ...process });
        }else {
            message.error(t('workflow.processTree.errors.parentNodeNotFound'));
        }
    }

     function getBranchEndNode(conditionNode: INode<keyof INodeProps>): INode<keyof INodeProps>{
      if (!conditionNode.children || !conditionNode.children.id){
        return conditionNode;
      }
      return getBranchEndNode(conditionNode.children);
    }

    function toMapping(node: INode<keyof INodeProps>){
      if (node && node.id){
        contextValue.nodeMap.set(node.id, node)
      }
    }
    function forEachNode(parent: INode<keyof INodeProps>, node: INode<keyof INodeProps>, callback: (parent: INode<keyof INodeProps>, node: INode<keyof INodeProps>)=>void){
        if (isBranchNode(node)){
            callback(parent, node)
            forEachNode(node, node.children!, callback)
            node.branchs?.map(branchNode => {
            callback(node, branchNode)
                forEachNode(branchNode, branchNode.children!, callback)
            })
        }else if (isPrimaryNode(node) || isEmptyNode(node) || isBranchSubNode(node)){
            callback(parent, node)
            forEachNode(node, node.children!, callback)
        }
    }
    function copyNode(node: INode<keyof INodeProps>){
        const parent = contextValue.nodeMap.get(node.parentId || '');
        if(parent){
            if(parent.branchs && parent.branchs.length > 0){
                const copyTarget = cloneDeep(node);
                copyTarget.id = getRandomId();
                copyTarget.parentId = parent.id;
                copyTarget.name = node.name + ' Copy';
                if(copyTarget?.props?.nodeNameEn) {
                    copyTarget.props.nodeNameEn = node.name + ' Copy';
                    copyTarget.props.nodeNameAr = node.name + ' Copy';
                }
                forEachNode(parent, copyTarget, (parent, node) => {
                    const id = getRandomId()
                    node.id = id;
                    node.parentId = parent.id;
                    node.parent = parent;
                })
                parent.branchs.splice(parent.branchs.indexOf(node), 0, copyTarget);
                onProcessChange({ ...process });
            } else {
                const copyTarget = cloneDeep(node);
                copyTarget.id = getRandomId();
                copyTarget.parentId = node.id;
                copyTarget.parent = node;
                const nodeChild = node.children!;
                nodeChild.parentId = copyTarget.id;
                nodeChild.parent = copyTarget;
                copyTarget.children = nodeChild;
                node.children = copyTarget;
                onProcessChange({ ...process });
            }
        }
        
    }
    function decodeAppendDom(node: INode<keyof INodeProps>, dom: React.ReactNode[], props = {}){
        if(node.type){
            const type = node.type?.charAt(0) + node.type?.slice(1).toLowerCase();
            const Component = getComponent(type);
            if(Component){
                dom.unshift(<Component 
                    active={selectedNode?.id === node.id}
                    node={node}
                    props={props}
                    key={node.id}
                    onFresh={() => onProcessChange({ ...process })}
                    onClick={() => onSelected(node)}
                    onInsertNode={(type: TNodeType) => insertNode(type, node)}
                    onDelNode={() => delNode(node)}
                    onCopy={() => copyNode(node)}
                    leftMove={() => branchMove(node, -1)}
                    rightMove={() => branchMove(node, 1)}
                />);
            }
        }
    }

    function branchMove(node: INode<keyof INodeProps>, offset: number){
        let parentNode = node.parent;
        if(parentNode && parentNode.branchs){
            let index = parentNode.branchs.indexOf(node);
            let branch = parentNode.branchs[index + offset];
            parentNode.branchs[index + offset] = parentNode.branchs[index];
            parentNode.branchs[index] = branch;
            onProcessChange({ ...process });
        }
    }

    function addBranchNode(node: INode<keyof INodeProps>){
      if (node?.branchs && node.branchs.length < 8){
        node.branchs.push({
          id: getRandomId(),
          parentId: node.id,
          name: (isConditionNode(node) ? 'Condition':'Branch') + (node.branchs.length + 1),
          props: isConditionNode(node) ? cloneDeep(DefaultNodeProps.CONDITION_PROPS) as INodeProps[keyof INodeProps] : {} as INodeProps[keyof INodeProps],
          type: isConditionNode(node) ? "CONDITION":"CONCURRENT",
          children:{}
        })
        onProcessChange({ ...process });
      }else {
        message.warning(t("workflow.processTree.warnings.maxBranches"));
      }
    }

    function getDomTree(node: INode<keyof INodeProps>): React.ReactNode[] {
        toMapping(node);
        if (isPrimaryNode(node)){
            let childDoms = node.children ? getDomTree(node.children) : [];
            decodeAppendDom(node, childDoms);
            return [<div key={node.id} className='primary-node'>{childDoms}</div>];
        } else if (isBranchNode(node)){
            let index = 0;
            let branchItems: React.ReactNode[] | undefined = node?.branchs?.map((branchNode: INode<keyof INodeProps>) => {
                toMapping(branchNode);
                let childDoms: React.ReactNode[] = [];
                if(branchNode.children){
                    childDoms = getDomTree(branchNode.children);
                    decodeAppendDom(branchNode, childDoms, {level: index + 1, size: node?.branchs?.length ?? 0});
                    if(node.branchs){
                        insertCoverLine(index, childDoms, node.branchs);
                    }
                }
                index++;
                return <div key={branchNode.id} className='branch-node-item'>{childDoms}</div>;
            });
            
            const addButton = (
                <div className='add-branch-btn'>
                    <Button 
                        className='add-branch-btn-el'
                        onClick={() => addBranchNode(node)}
                    >
                        {isConditionNode(node)
                            ? t('workflow.processTree.branches.addCondition')
                            : t('workflow.processTree.branches.addBranch')}
                    </Button>
                </div>
            );
            
            const branchNodes = branchItems ? [...branchItems] : [];
            branchNodes.unshift(addButton);
            
            const bchDom = <div className='branch-node'>{branchNodes}</div>;
            let afterChildDoms = node.children ? getDomTree(node.children) : [];
            return [<div key={node.id}>{bchDom}{afterChildDoms}</div>];
        }else if (isEmptyNode(node)){
            let childDoms = node.children ? getDomTree(node.children) : [];
            decodeAppendDom(node, childDoms);
            return [<div key={node.id} className='empty-node'>{childDoms}</div>];
        }else {
            return [];
        }
    }

    contextValue.nodeMap.clear()
    const processTrees = getDomTree(process);

    return <Context.Provider value={contextValue}>
        {processTrees}
    </Context.Provider>
}
