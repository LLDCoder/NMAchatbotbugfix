import InsertButton from "./InsertButton"
import type { TNodeType } from '.';

export interface ILineProps {
    onInsertNode: (nodeType: TNodeType) => void;
 }

export default function Line({onInsertNode} : ILineProps) { 
    return <div className="node-line">
        <InsertButton onInsertNode={onInsertNode} />
    </div>
}