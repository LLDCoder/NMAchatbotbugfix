

import { useState } from "react"
import type { IConfig, TNodeType } from '.';
import Node from "./Node"
import Setup from "@/assets/icons/Setup";
import { useTranslation } from "react-i18next";

interface IApprovalProps {
    config: IConfig,
    onClick: () => {},
    onInsertNode: (type: TNodeType) => {},
    onDelNode: () => void;
}

export default function Delay({config, onClick, onInsertNode, onDelNode}: IApprovalProps){
    const { t } = useTranslation();
    const [showError, setShowError] = useState(false);
    const [errorInfo, setErrorInfo] = useState('');

    return <Node title={config?.name} onClick={onClick} onDelNode={onDelNode} onInsertNode={onInsertNode} placeholder={t("workflow.processTree.trigger.placeholder")} headerBgc="#47bc82" showError={showError} errorInfo={errorInfo} content={''} headerIcon={<Setup />} />
}
