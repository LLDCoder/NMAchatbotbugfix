import Node from './Node';
import type { TNodeType } from '.';
interface IEmptyProps{
    onInsertNode: (type: TNodeType) => void
}
export default function Empty({ onInsertNode }: IEmptyProps) { 
    return <Node show={false} onInsertNode={onInsertNode} />
}