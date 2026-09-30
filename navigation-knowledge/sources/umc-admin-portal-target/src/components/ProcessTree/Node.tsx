import React, { useContext } from "react";
import { Tooltip } from "@mantine/core";
import Close from "../../assets/icons/Close";
import Right from "../../assets/icons/Right";
import Warn from "../../assets/icons/Warn";
import InsertButton from "./InsertButton";
import type {TNodeType} from '.';
import { Context } from '.';

interface INodeProps {
    title?: string;
    isRoot?: boolean;
    content?: string | null;
    placeholder?: string;
    headerBgc?: string;
    onClick?: () => void;
    headerIcon?: React.ReactNode;
    show?:boolean;
    showError?: boolean;
    leftIcon?: React.ReactNode;
    onInsertNode?: (type: TNodeType) => void;
    onDelNode?: () => void;
    errorInfo?: string;
}

export default function Node ({ isRoot, show = true, onInsertNode, onDelNode, showError = false, errorInfo,headerBgc, headerIcon, title, leftIcon, placeholder, content = '', onClick }: INodeProps) {
    const { diagramMode } = useContext(Context);
    return <div className={`node ${isRoot || !show ? 'root' : ''} ${showError ? 'node-error-state' : ''}`}>
        {show && <div className={`node-body ${showError ? 'error' : ''}`} onClick={onClick}>
            <div>
                <div className="node-body-header" style={{backgroundColor: headerBgc}}>
                    {headerIcon}
                    <div className="name">{title}</div>
                    { !isRoot && diagramMode !== 'viewer' && <Close onClick={(e)=>{
                        e.stopPropagation();
                       onDelNode && onDelNode();
                    }} className="close-icon" />}
                </div>
                <div className="node-body-content">
                    {leftIcon}
                    {!content?.trim() ? <span className="placeholder">{placeholder}</span> : <div className="lines">{content}</div>}
                    {diagramMode !== 'viewer' && <div className="arrow-right"><Right /></div>}
                </div>
                {showError && <div className="node-error">
                    <Tooltip label={errorInfo}>
                        <div>
                            <Warn />
                        </div>
                    </Tooltip>
                </div>}
            </div>
        </div>}
        <div className="node-footer">
            <div className="btn">
                <InsertButton onInsertNode={onInsertNode} />
            </div>
        </div>
    </div>
}
