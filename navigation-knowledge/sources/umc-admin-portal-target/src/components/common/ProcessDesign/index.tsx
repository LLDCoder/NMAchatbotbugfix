import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import ProcessTree from '@/components/ProcessTree';
import type { INode, TNodeType, INodeProps } from '@/components/ProcessTree';
import NodeConfig from '../../ProcessTree/NodeConfig';
import { isBranchNode, getRandomId } from '@/components/ProcessTree';
import DraggableCanvas from '../../ProcessTree/DraggableCanvas';
import request from '@/utils/request';
import './index.css'
import type { AxiosResponse } from 'axios';
import { useServiceStore } from "@/store/service-store";
import { useDictStore } from "@/store/dict-store";
import type { IDict, IRoleDept } from "@/store/dict-store";
import { useTranslation } from 'react-i18next';
import { isArabicLanguage } from "@/localization/language";
import CustomMessage from '../CustomMessage';
interface IBpmnNodes{
    id: string;
    type: 'startEvent' | 'exclusiveGateway' | 'parallelGateway' | 'intermediateCatchEvent' | 'userTask' | 'serviceTask' | 'endEvent';
    name: string;
}
interface IShapes{
    id: string;
    elementId: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
interface ISequenceFlow{
    id: string;
    sourceRef: string;
    targetRef: string;
}
interface IEdges{
    id: string;
    bpmnElement: string;
    waypoints: {
        x: number;
        y: number;
    }[]
}
interface IGetBpmnNodesParams{
    process: INode<keyof INodeProps>;
    nodes: IBpmnNodes[];
    shapes: IShapes[];
    sequenceFlows:  ISequenceFlow[];
    edges: IEdges[];
    nodesProps: INodeProps[keyof INodeProps][];
}
export interface IProcessDesignRef{
    save?: () => Promise<AxiosResponse<any, any, {}>>
}
export function getRandomFlowId(){
    return `Flow_${new Date().getTime().toString().substring(5)}${Math.round(Math.random()*9000+1000)}`
}
function getPrefixRandomId(prefix?: string){
    return `${prefix}_${new Date().getTime().toString().substring(5)}${Math.round(Math.random()*9000+1000)}`
}
interface IworkflowConfiguration{
    bpmnJson: string;
    createdBy: number;
    createdOn: string;
    deployedAt: string | null;
    deploymentId: number | null;
    id: number;
    processDefinitionKey: string;
    serviceId: number;
    serviceMiddleConfigId: number;
    status: string;
    updatedOn: string;
    version: number;
    workflowEdges: any[];
    workflowNameAr: string;
    workflowNameEn: string;
    workflowNodes: any[];
    workflowType: string;
}
export interface IServiceData {
  serviceId: any;
  serviceCode: any;
  serviceName: string;
  nameEn: string;
  nameAr: string;
  serviceCategoryId: any;
  type: any;
  department: any;
  scope: string;
  userType: string;
  isLoginRequired: any;
  status: any;
  loadedAt: string;
  workflowConfigurations: IworkflowConfiguration[];
}
interface ProcessDesignProps {
    onDirtyChange?: (dirty: boolean) => void;
}
interface IApiData<T>{
    data: T;
}
interface IDepartmentPageData{
    items: IDict[];
}
export function validateUserTask(nodeProp?: INodeProps['approval']){
    if(!nodeProp){
        return false;
    } 
    if(!nodeProp.nodeNameEn){
        return false;
    }
    // if(!nodeProp.nodeDescription){
    //     return false;
    // }
    if(!nodeProp.approvalDepartment){
        return false;
    }
    if(!nodeProp.approvalRole){
        return false;
    }
    if(nodeProp.slaTime === 0){
        return false;
    }
    if(!nodeProp.slaType){
        return false;
    }
    return true;
}
function ProcessDesign({ onDirtyChange }: ProcessDesignProps,ref: React.Ref<IProcessDesignRef>) {
    const { i18n, t } = useTranslation();
    const currentLanguage = i18n.resolvedLanguage || i18n.language;
    const isArabic = isArabicLanguage(currentLanguage);
    const serviceData = useServiceStore((state) => state.serviceData);
    const setApprovalRole = useDictStore((state)=>state.setApprovalRole);
    const setApprovalDepartment = useDictStore((state)=>state.setApprovalDepartment);
    const { serviceId, serviceName, nameAr, nameEn } = serviceData || {};
    const setApprovalRoleDepartment = useDictStore((state)=>state.setApprovalRoleDepartment);
    const [processId, setProcessId] = useState<number | null>(null);
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    const [mode, setMode] = useState<string>(from ?? 'edit');
    const suppressDirtyTrackingRef = useRef(true);
    const [process, setProcess] = useState<INode<keyof INodeProps>>(() : INode<keyof INodeProps> => {
        const rootId = getRandomId();
        const root : INode<keyof INodeProps> = {
            id: rootId,
            parentId: null,
            type: "ROOT",
            name: t("node.initiator.name"),
        }
        root.children = { id: getRandomId(), parentId: rootId, parent: root, type: "PROCESSEND" }
        return root;
    });
    const [selectedNode, setSelectedNode] = useState<INode<keyof INodeProps> | null>(null);
    function onProcessChange(newProcess: INode<keyof INodeProps>){
        setProcess(newProcess);
        if(!suppressDirtyTrackingRef.current){
            onDirtyChange?.(true);
        }
    }
    function getType(node: IBpmnNodes){
        switch(node.type){
            case 'startEvent':
                return 'ROOT';
            case 'userTask':
                return 'APPROVAL';
            case 'exclusiveGateway':
                return 'CONDITION';
            case 'parallelGateway':
                return 'CONCURRENT';
            case 'intermediateCatchEvent':
                return 'DELAY';
            case 'serviceTask':
                return 'TRIGGER';
            case 'endEvent':
                return 'PROCESSEND';

        }
    }
    function getWorkflowNodeDisplayName(
        node?: IBpmnNodes,
        nodeProps?: INodeProps[keyof INodeProps]
    ){
        if(isArabic){
            return nodeProps?.nodeNameAr || nodeProps?.nodeNameEn || node?.name;
        }
        return nodeProps?.nodeNameEn || nodeProps?.nodeNameAr || node?.name;
    }
    function getWorkflowJson(workflowConfiguration: IworkflowConfiguration){
        const workflowNodes = workflowConfiguration.workflowNodes;
        const obj = JSON.parse(workflowConfiguration.bpmnJson);
        const sequenceFlows = obj.definitions.process.sequenceFlows;
        const nodes: IBpmnNodes[] = obj.definitions.process.nodes;
        const process: INode<keyof INodeProps> = {};
        let children: INode<keyof INodeProps> | null = null;
        for(let item of sequenceFlows){
            const targetNode = nodes.find((node) => node.id === item.targetRef);
            const targetNodeProps = workflowNodes.find((node) => node.nodeId === item.targetRef);
            if(children !== null && targetNode){
                const targetNodeType = getType(targetNode!);
                children.children = {
                    id: mode === 'add' ? getRandomId() : targetNode?.id,
                    name: getWorkflowNodeDisplayName(targetNode, targetNodeProps),
                    parentId: children.id,
                    type: targetNodeType,
                    props: targetNodeProps,
                    parent: children,
                }
                children = children.children;
            } else {
                const sourceNodeProps = workflowNodes.find((node) => node.nodeId === item.sourceRef);
                const sourceNode = nodes.find((node) => node.id === item.sourceRef);
                process.id = mode === 'add' ? getRandomId() : sourceNode?.id;
                process.name = getWorkflowNodeDisplayName(sourceNode, sourceNodeProps);
                process.type = getType(sourceNode!);
                process.props = sourceNodeProps;

                const targetNodeType = getType(targetNode!);
                process.children = {
                    id: mode === 'add' ? getRandomId() : targetNode?.id,
                    parentId: sourceNode?.id,
                    name: getWorkflowNodeDisplayName(targetNode, targetNodeProps),
                    type: targetNodeType,
                    props: targetNodeProps,
                    parent: process,
                }
                children = process.children;
            }
            
        }
        return process;
    }
    useEffect(()=>{
        request.get<IApiData<IRoleDept[]>, IApiData<IRoleDept[]>>('/api/Role/GetRoleDeptartment').then((res)=>{
            if(Array.isArray(res.data)){
                setApprovalRoleDepartment(res.data);
            }
        })
        request.get<IApiData<IDepartmentPageData>, IApiData<IDepartmentPageData>>('/api/Departments/Departments', { pageSize: 999 }).then((res)=>{
            setApprovalDepartment(res.data.items);
        });
        request.get<IApiData<IDict[]>, IApiData<IDict[]>>('/api/Role/GetRoleByDiscriminator/ApprovalRole').then((resp)=>{
            setApprovalRole(resp.data);
        });
    }, []);
    useEffect(()=>{
        suppressDirtyTrackingRef.current = true;
        if(serviceData?.workflowConfigurations?.[0]){
            const process = getWorkflowJson(serviceData.workflowConfigurations[0]);
            setProcessId(mode === 'add' ? null : serviceData.workflowConfigurations[0].processDefinitionKey);
            setProcess(process);
        }
        const timer = window.setTimeout(() => {
            suppressDirtyTrackingRef.current = false;
        }, 0);
        return () => {
            window.clearTimeout(timer);
        };
    }, [currentLanguage, mode, serviceData?.workflowConfigurations, serviceId]);
    function getBpmnType(processType: TNodeType){
        switch(processType){
            case 'ROOT':
                return 'startEvent';
            case 'APPROVAL':
            case 'CC':
                return 'userTask';
            case 'CONDITION':
                return 'exclusiveGateway';
            case 'CONCURRENT':
                return 'parallelGateway';
            case 'DELAY':
                return 'intermediateCatchEvent';
            case 'TRIGGER':
                return 'serviceTask';
            case 'PROCESSEND':
                return 'endEvent';

        }
    }
    
    const bpmnx = 400;
    function getShapesByType(type: IBpmnNodes['type'], y: number){
        switch(type){
            case "startEvent":
                return {
                    x: bpmnx,
                    y: 0,
                    width: 36,
                    height: 36,
                }
            case "userTask":
                return {
                    x: bpmnx - 50 + 18,
                    y: y,
                    width: 100,
                    height: 80,
                }
            case "endEvent":
                return {
                    x: bpmnx,
                    y: y,
                    width: 36,
                    height: 36,
                }
            default:
                return { x:0, y:0, width: 0, height: 0}
        }
    }
    function getWaypoints(prevY: number, type: IBpmnNodes['type'], shape: IShapes){
        const { x, y, width, height } = shape;
        const { x: cx, y: cy, width: cwidth } = getShapesByType(type, prevY + 50)
        return [
            { x: x + width / 2, y: y + height },
            { x: cx + cwidth / 2, y: cy }
        ]
    }
    function getBpmnNodes(y: number,{
            process,
            nodes,
            shapes,
            sequenceFlows,
            edges,
            nodesProps
        }: IGetBpmnNodesParams){
        const nodeType = getBpmnType(process.type!);
        if(!nodeType){
            return ;
        }
        if(process.type === 'PROCESSEND'){
            nodes.push({
                id: process.id!,
                type: 'endEvent',
                name: t("node.processEnd.name"),
            });
            shapes.push({
                id: 'Shape_' + process.id!,
                elementId: process.id!,
                ...getShapesByType(nodeType, y)
            });
            const nodeProp = {
                ...process.props,
                nodeId: process.id,
                nodeType,
                nodeNameAr: i18n.t("node.processEnd.name", { lng: "ar" }),
                nodeNameEn: i18n.t("node.processEnd.name", { lng: "en" }),
                nodeOrder: nodesProps.length + 1,
                slaType: '',
                slaTimes: 0
            }
            nodesProps.push(nodeProp);
            return ;
        }
        if(process.type === 'EMPTY'){
            if(process.children && Object.keys(process.children).length > 0){
                getBpmnNodes(y, {
                    process: process.children,
                    nodes, shapes, sequenceFlows,
                    edges, nodesProps
                });
            }
        }else {
            nodes.push({
                id: process.id!,
                type: nodeType,
                name: process.name!,
            });
            const shape = {
                id: 'Shape_' + process.id!,
                elementId: process.id!,
                ...getShapesByType(nodeType, y)
            }
            y = shape.y + shape.height;
            shapes.push(shape);
           
            if(isBranchNode(process)){
                process?.branchs?.forEach(item=>{
                     sequenceFlows.push({
                        id: getRandomFlowId(),
                        sourceRef: process.id!,
                        targetRef: item.id!,
                    });
                    getBpmnNodes(y + 50, {
                        process: item, nodes, shapes, sequenceFlows, edges, nodesProps
                    })
                })
            } else {
                if(process.children && Object.keys(process.children).length > 0){
                    const flowId = getRandomFlowId();
                    sequenceFlows.push({
                        id: flowId,
                        sourceRef: process.id!,
                        targetRef: process.children?.id!,
                    });
                     const waypoints = getWaypoints(y,getBpmnType(process.children.type!)!, shape);
                    edges.push({
                        id: "Edge_" + flowId,
                        bpmnElement: flowId,
                        waypoints: waypoints
                    });
                    const nodeProp: INodeProps[keyof INodeProps] = {
                        ...process.props,                        
                        nodeId: process.id,
                        nodeType,
                        nodeNameAr: process.props?.nodeNameAr || process.name,
                        nodeNameEn: process.props?.nodeNameEn || process.name,
                        nodeOrder: nodesProps.length + 1,
                    }
                    if(process.type === 'ROOT'){
                        nodeProp.slaTime = 0;
                        nodeProp.slaType = '';
                    }
                    nodesProps.push(nodeProp)
                    getBpmnNodes(y + 50,{
                        process: process.children, nodes, shapes, sequenceFlows, edges, nodesProps
                    });
                }
            }
        }
        
    }
    function getBpmnJson(){
        const nodes: IBpmnNodes[] = [];
        const shapes: IShapes[] = [];
        const sequenceFlows: ISequenceFlow[] = [];
        const edges: IEdges[] = [];
        const nodesProps:INodeProps[keyof INodeProps][] = [];
        getBpmnNodes(0, {
            process,
            nodes,
            shapes,
            sequenceFlows,
            edges,
            nodesProps
        })
        const definitionsId = getPrefixRandomId('Definitions');
        const processID = processId || getPrefixRandomId('Process');
        return [{
            "definitions": {
                "id": definitionsId,
                "name": serviceName,
                "targetNamespace": "http://camunda.org/schema/1.0/bpmn",
                "process": {
                    "id": processID,
                    "name": serviceName,
                    "isExecutable": true,
                    "historyTimeToLive":120,
                    "candidateStarterGroups": "custorm",
                    "documentation": serviceName,
                    "dataObjects": [],
                    "lanes": [],
                    "nodes": nodes,
                    "sequenceFlows": sequenceFlows,
                    "messages": []
                },
                "diagram": {
                    "id": getPrefixRandomId("BPMNDiagram"),
                    "plane": {
                        "id": getPrefixRandomId("BPMNPlane"),
                        "shapes": shapes,
                        "edges": edges,
                    }
                }
            }
        }, nodesProps, processID] as [any, INodeProps[keyof INodeProps][], string];
    }
    function validateFields(nodesProps: INodeProps[keyof INodeProps][]){
        for(let i = 0;i<nodesProps.length;i++){
            const item = nodesProps[i];
            if(item.nodeType === 'userTask' && !validateUserTask(item)){
                return false;
            }
        }
        return true;
    }
    async function handleSave(){
        const [bpmnJson, nodesProps, processId] = getBpmnJson();
        if(nodesProps.length <= 2){
            CustomMessage.error(t("workflow.please.min2Node"));
            return Promise.reject();
        }
        if(!validateFields(nodesProps)){
            CustomMessage.error(t("workflow.please.fillAll"));
            return Promise.reject();
        }
        const workflowConfiguration = serviceData?.workflowConfigurations?.[0];
        if(workflowConfiguration && mode === 'edit'){
            return request.post('/api/ServiceWorkflowConfigurationController/UpdateWorkflowConfiguration', {
                id: workflowConfiguration.id,
                ProcessDefinitionKey: processId,
                serviceId,
                WorkflowNameEn: nameEn,
                WorkflowNameAr: nameAr,
                bpmnJson: JSON.stringify(bpmnJson),
                workflowNodes: nodesProps,
            });
        } else {
            return request.post('/api/ServiceWorkflowConfigurationController/AddWorkflowConfiguration', {
                ProcessDefinitionKey: processId,
                serviceId,
                WorkflowNameEn: nameEn,
                WorkflowNameAr: nameAr,
                bpmnJson: JSON.stringify(bpmnJson),
                workflowNodes: nodesProps,
            }).then((res) => {
                if(res.data){
                    setMode('edit');
                }
                return res;
            });
           
        }
        
    }

    useImperativeHandle(ref, () => {
        return {
            save: async () => {
                return await handleSave();
            }
        }
    })
    return (
        <div className='process-design-container'>
            <div className='process-design'>
                <div className='design-wrapper'>
                    <DraggableCanvas>
                        <div className='designer'>
                            <ProcessTree selectedNode={selectedNode} process={process} onProcessChange={onProcessChange} onSelected={(node)=>{
                                if(node?.id === selectedNode?.id){
                                    setSelectedNode(null);
                                } else {
                                    setSelectedNode(node);  
                                }
                            }} />
                        </div>
                    </DraggableCanvas>
                </div>
                <div className='node-properties-configration'>
                    <NodeConfig
                        process={process}
                        onProceessChange={onProcessChange}
                        selectNode={selectedNode} />
                </div>
            
            </div>
        </div>
    )
}
export default React.forwardRef(ProcessDesign);
