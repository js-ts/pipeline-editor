import React, { useState, DragEvent } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  updateEdge,
  removeElements,
  Controls,
  OnLoadParams,
  Elements,
  Connection,
  Edge,
  ElementId,
  Node,
} from 'react-flow-renderer';

import Sidebar from './Sidebar';

import './dnd.css';

const initialElements = [{ id: '1', type: 'input', data: { label: 'input node' }, position: { x: 250, y: 5 } }];

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

let id = 0;
const getId = (): ElementId => `dndnode_${id++}`;

const DnDFlow = () => {
  const [reactFlowInstance, setReactFlowInstance] = useState<OnLoadParams>();
  const [elements, setElements] = useState<Elements>(initialElements);

  // gets called after end of edge gets dragged to another source or target
  const onEdgeUpdate = (oldEdge: Edge, newConnection: Connection) =>
    setElements((els) => updateEdge(oldEdge, newConnection, els));
  const onConnect = (params: Connection | Edge) => setElements((els) => addEdge(params, els));
  const onElementsRemove = (elementsToRemove: Elements) => setElements((els) => removeElements(elementsToRemove, els));
  const onLoad = (_reactFlowInstance: OnLoadParams) => setReactFlowInstance(_reactFlowInstance);

  const onEdgeUpdateStart = (_: React.MouseEvent, edge: Edge) => console.log('start update', edge);
  const onEdgeUpdateEnd = (_: MouseEvent, edge: Edge) => console.log('end update', edge);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    if (reactFlowInstance) {
      const type = event.dataTransfer.getData('application/reactflow');
      const position = reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 });
      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      setElements((es) => es.concat(newNode));
    }
  };

  return (
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <ReactFlow
            elements={elements}
            onConnect={onConnect}
            onElementsRemove={onElementsRemove}
            onEdgeUpdateStart={onEdgeUpdateStart}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            onEdgeUpdate={onEdgeUpdate}
            onLoad={onLoad}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <Controls />
          </ReactFlow>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;