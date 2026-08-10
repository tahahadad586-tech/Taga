import { Handle, Position, type NodeProps } from 'reactflow';
import { CATEGORY_LABELS_AR, NODE_CATALOG_BY_TYPE } from '@taga/shared';

export default function TagaNode({ data, selected }: NodeProps<{ nodeType: string }>) {
  const definition = NODE_CATALOG_BY_TYPE[data.nodeType];
  if (!definition) {
    return <div className="taga-node">عقدة غير معروفة</div>;
  }
  return (
    <div className={`taga-node${selected ? ' selected' : ''}`}>
      <div className="category">{CATEGORY_LABELS_AR[definition.category] ?? definition.category}</div>
      <div>{definition.labelAr}</div>
      {definition.inputs.map((input, index) => (
        <Handle
          key={input}
          id={input}
          type="target"
          position={Position.Right}
          style={{ top: 20 + index * 16 }}
          title={input}
        />
      ))}
      {definition.outputs.map((output, index) => (
        <Handle
          key={output}
          id={output}
          type="source"
          position={Position.Left}
          style={{ top: 20 + index * 16 }}
          title={output}
        />
      ))}
    </div>
  );
}
