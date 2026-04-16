(function() {
  const nodes = window.graphNodes || [];
  const rawEdges = window.graphEdges || [];
  const typeColors = window.graphTypeColors || {};
  const typeLabels = window.graphTypeLabels || {};

  const infoBody = document.getElementById('info-body');
  const pathFrom = document.getElementById('path-from');
  const pathTo = document.getElementById('path-to');
  const pathBtn = document.getElementById('path-btn');
  const pathClear = document.getElementById('path-clear');
  const pathResult = document.getElementById('path-result');
  const cyZoomIn = document.getElementById('cy-zoom-in');
  const cyZoomOut = document.getElementById('cy-zoom-out');
  const cyFitBtn = document.getElementById('cy-fit');
  const connectBtn = document.getElementById('connect-btn');
  const deleteEdgeBtn = document.getElementById('delete-edge-btn');
  const editNodeBtn = document.getElementById('edit-node-btn');
  const exportBtn = document.getElementById('export-btn');

  if (!infoBody || !pathFrom || !pathTo || !pathBtn || !pathClear || !pathResult || !cyZoomIn || !cyZoomOut || !cyFitBtn || !connectBtn || !deleteEdgeBtn || !editNodeBtn || !exportBtn) {
    return;
  }

  const elements = [];
  const edges = rawEdges.map((edge, index) => {
    if (Array.isArray(edge)) {
      return { id: `e${index}`, source: edge[0], target: edge[1] };
    }
    return {
      id: edge.id || `e${index}`,
      source: edge.source,
      target: edge.target
    };
  });
  window.graphEdges = edges.slice();

  nodes.forEach(n => {
    elements.push({ data: { id: n.id, label: n.label, type: n.type }, position: n.pos });
  });
  edges.forEach(edge => {
    elements.push({ data: { id: edge.id, source: edge.source, target: edge.target } });
  });

  nodes.forEach(n => {
    const optionA = document.createElement('option');
    optionA.value = n.id;
    optionA.textContent = n.label;
    pathFrom.appendChild(optionA);

    const optionB = document.createElement('option');
    optionB.value = n.id;
    optionB.textContent = n.label;
    pathTo.appendChild(optionB);
  });

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    layout: { name: 'preset' },
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          color: '#b8d8ee',
          'font-family': '"Share Tech Mono", monospace',
          'font-size': '9px',
          'text-margin-y': '4px',
          'text-outline-width': 2,
          'text-outline-color': '#040b12',
          width: 18,
          height: 18,
          'border-width': 2,
          'background-color': ele => typeColors[ele.data('type')]?.bg || '#1a3a5c',
          'border-color': ele => typeColors[ele.data('type')]?.border || '#2a5a8c',
          'transition-property': 'width, height, background-color, border-color',
          'transition-duration': '0.15s',
        }
      },
      { selector: 'node[type="reactor"]', style: { width: 28, height: 28, shape: 'hexagon' } },
      { selector: 'node[type="key"]', style: { width: 22, height: 22, shape: 'diamond' } },
      { selector: 'node[type="crystal"]', style: { width: 22, height: 22 } },
      { selector: 'node[type="deadend"]', style: { width: 12, height: 12, opacity: 0.6 } },
      { selector: 'node[type="junction"]', style: { width: 16, height: 16, shape: 'triangle' } },
      { selector: 'node[type="hall"]', style: { width: 14, height: 14 } },
      { selector: 'node[type="elevator_red"]', style: { width: 20, height: 20, shape: 'square' } },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': '#1a4a6e',
          'curve-style': 'bezier',
          opacity: 0.7,
          'transition-property': 'line-color, width, opacity',
          'transition-duration': '0.15s',
        }
      },
      {
        selector: 'node.selected',
        style: {
          'border-color': '#00d4ff',
          'border-width': 3,
          width: 28,
          height: 28,
        }
      },
      {
        selector: 'node.neighbor',
        style: {
          'border-color': '#00d4ff88',
          'border-width': 2,
          opacity: 1,
        }
      },
      { selector: 'node.faded', style: { opacity: 0.2 } },
      { selector: 'edge.highlighted', style: { 'line-color': '#00d4ff', width: 2.5, opacity: 1 } },
      { selector: 'edge.faded', style: { opacity: 0.08 } },
      { selector: 'edge.path-edge', style: { 'line-color': '#44ff88', width: 3, opacity: 1 } },
      { selector: 'node.path-node', style: { 'border-color': '#44ff88', 'border-width': 3, 'background-color': '#1a4a2a' } },
    ],
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
  });

  cy.fit(cy.nodes(), 60);

  // Enable editing
  cy.nodes().grabify(); // Allow moving nodes

  // Delete selected elements on delete key
  document.addEventListener('keydown', function(e) {
    if (e.keyCode === 46) { // Delete key
      cy.$(':selected').remove();
    }
  });

  // Update data on changes
  cy.on('position', 'node', function(evt) {
    const node = evt.target;
    const id = node.id();
    const pos = node.position();
    const nodeData = window.graphNodes.find(n => n.id === id);
    if (nodeData) {
      nodeData.pos = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  });

  cy.on('add', 'node', function(evt) {
    const node = evt.target;
    const data = node.data();
    window.graphNodes.push({
      id: data.id,
      label: data.label,
      type: data.type,
      pos: node.position()
    });
  });

  cy.on('add', 'edge', function(evt) {
    const edge = evt.target;
    const data = edge.data();
    window.graphEdges.push({ id: data.id, source: data.source, target: data.target });
  });

  cy.on('remove', 'node', function(evt) {
    const node = evt.target;
    const id = node.id();
    window.graphNodes = window.graphNodes.filter(n => n.id !== id);
    // Also remove connected edges
    window.graphEdges = window.graphEdges.filter(e => e.source !== id && e.target !== id);
  });

  cy.on('remove', 'edge', function(evt) {
    const edge = evt.target;
    const id = edge.id();
    window.graphEdges = window.graphEdges.filter(e => e.id !== id);
  });

  // Add node on double-click
  cy.on('dblclick', function(evt) {
    if (evt.target === cy) {
      const pos = evt.position;
      const id = 'node_' + Date.now();
      const label = prompt('Node label:');
      if (!label) return;
      const type = prompt('Node type (e.g., room, key):') || 'room';
      cy.add({
        data: { id, label, type },
        position: pos
      });
    }
  });

  // Export button
  exportBtn.onclick = function() {
    const exportEdges = window.graphEdges.map(edge => [edge.source, edge.target]);
    const payload = `Nodes:\n${JSON.stringify(window.graphNodes, null, 2)}\n\nEdges:\n${JSON.stringify(exportEdges, null, 2)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => {
        alert('Graph data copied to clipboard.');
      }).catch(() => {
        alert('Unable to copy to clipboard. Check console for graph output.');
        console.log(payload);
      });
    } else {
      alert('Clipboard unavailable. Check console for graph output.');
      console.log(payload);
    }
  };

  // Add connect, delete edge and edit node buttons
  let connectMode = false;
  let connectNodes = [];
  let deleteEdgeMode = false;
  let deleteEdgeNodes = [];
  let editNodeMode = false;
  let editTarget = null;

  connectBtn.onclick = function() {
    connectMode = !connectMode;
    deleteEdgeMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    connectBtn.textContent = connectMode ? 'Cancel Connect' : 'Connect Nodes';
    connectBtn.style.background = connectMode ? '#ffaa00' : '';
    deleteEdgeBtn.textContent = 'Delete Edge';
    deleteEdgeBtn.style.background = '';
  };

  deleteEdgeBtn.onclick = function() {
    deleteEdgeMode = !deleteEdgeMode;
    connectMode = false;
    editNodeMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    editTarget = null;
    deleteEdgeBtn.textContent = deleteEdgeMode ? 'Cancel Delete' : 'Delete Edge';
    deleteEdgeBtn.style.background = deleteEdgeMode ? '#ff6666' : '';
    connectBtn.textContent = 'Connect Nodes';
    connectBtn.style.background = '';
    editNodeBtn.textContent = 'Edit Node';
    editNodeBtn.style.background = '';
  };

  editNodeBtn.onclick = function() {
    editNodeMode = !editNodeMode;
    connectMode = false;
    deleteEdgeMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    editTarget = null;
    editNodeBtn.textContent = editNodeMode ? 'Cancel Edit' : 'Edit Node';
    editNodeBtn.style.background = editNodeMode ? '#66ccff' : '';
    connectBtn.textContent = 'Connect Nodes';
    connectBtn.style.background = '';
    deleteEdgeBtn.textContent = 'Delete Edge';
    deleteEdgeBtn.style.background = '';
  };

  function resetInfo() {
    infoBody.innerHTML = '<div class="info-empty">Click a node to inspect<br>its location data and<br>connected tunnels.</div>';
    pathResult.textContent = 'Select two nodes to find a route.';
  }

  cy.on('tap', 'node', evt => {
    const node = evt.target;
    const data = node.data();

    if (connectMode) {
      connectNodes.push(node);
      if (connectNodes.length === 2) {
        const source = connectNodes[0].id();
        const target = connectNodes[1].id();
        if (source !== target) {
          cy.add({ data: { id: `e${Date.now()}`, source, target } });
        }
        connectNodes = [];
        connectMode = false;
        connectBtn.textContent = 'Connect Nodes';
        connectBtn.style.background = '';
      }
      return;
    }

    if (editNodeMode) {
      if (!editTarget) {
        editTarget = node;
        alert('Selected node for editing. Click it again to update label/type.');
        return;
      }

      const newLabel = prompt('New label:', editTarget.data('label'));
      if (newLabel === null) {
        editTarget = null;
        return;
      }
      const newType = prompt('New type (e.g., room, key):', editTarget.data('type')) || editTarget.data('type');
      editTarget.data('label', newLabel);
      editTarget.data('type', newType);
      const nodeData = window.graphNodes.find(n => n.id === editTarget.id());
      if (nodeData) {
        nodeData.label = newLabel;
        nodeData.type = newType;
      }
      editTarget = null;
      editNodeMode = false;
      editNodeBtn.textContent = 'Edit Node';
      editNodeBtn.style.background = '';
      alert('Node updated.');
      return;
    }

    if (deleteEdgeMode) {
      deleteEdgeNodes.push(node);
      if (deleteEdgeNodes.length === 2) {
        const source = deleteEdgeNodes[0].id();
        const target = deleteEdgeNodes[1].id();
        const edge = cy.edges().filter(e => {
          const s = e.data('source');
          const t = e.data('target');
          return (s === source && t === target) || (s === target && t === source);
        }).first();
        if (edge.length) {
          edge.remove();
        }
        deleteEdgeNodes = [];
        deleteEdgeMode = false;
        deleteEdgeBtn.textContent = 'Delete Edge';
        deleteEdgeBtn.style.background = '';
      }
      return;
    }

    const neighbors = node.neighborhood();
    const connNodes = neighbors.nodes();
    const connList = connNodes.map(n => `<li>${n.data('label')}</li>`).join('');

    cy.elements().removeClass('selected neighbor faded highlighted path-edge path-node');
    const connEdges = node.connectedEdges();
    cy.elements().not(node).not(neighbors).addClass('faded');
    neighbors.nodes().addClass('neighbor');
    connEdges.addClass('highlighted');
    node.addClass('selected');

    infoBody.innerHTML = `
      <div class="info-name">${data.label}</div>
      <div class="info-type">${typeLabels[data.type] || data.type}</div>
      <div class="info-conn-label">Connected (${connNodes.length})</div>
      <ul class="info-conn-list">${connList || '<li style="color:var(--text-dim)">None</li>'}</ul>
    `;
  });

  cy.on('tap', evt => {
    if (evt.target === cy) {
      cy.elements().removeClass('selected neighbor faded highlighted path-edge path-node');
      resetInfo();
      if (connectMode) {
        connectMode = false;
        connectNodes = [];
        connectBtn.textContent = 'Connect Nodes';
        connectBtn.style.background = '';
      }
      if (deleteEdgeMode) {
        deleteEdgeMode = false;
        deleteEdgeNodes = [];
        deleteEdgeBtn.textContent = 'Delete Edge';
        deleteEdgeBtn.style.background = '';
      }
      if (editNodeMode) {
        editNodeMode = false;
        editTarget = null;
        editNodeBtn.textContent = 'Edit Node';
        editNodeBtn.style.background = '';
      }
    }
  });

  function findPath() {
    const fromId = pathFrom.value;
    const toId = pathTo.value;
    if (!fromId || !toId) {
      pathResult.textContent = 'Select both From and To nodes.';
      return;
    }
    if (fromId === toId) {
      pathResult.textContent = 'From and To must be different nodes.';
      return;
    }

    cy.elements().removeClass('path-edge path-node selected neighbor faded highlighted');
    const dijkstra = cy.elements().dijkstra({ root: `#${fromId}`, directed: false });
    const pathToNode = cy.$(`#${toId}`);
    const path = dijkstra.pathTo(pathToNode);

    if (path.length === 0) {
      pathResult.textContent = '⚠ No route found between these nodes.';
      return;
    }

    cy.elements().not(path).addClass('faded');
    path.nodes().addClass('path-node');
    path.edges().addClass('path-edge');

    const nodeCount = path.nodes().length;
    const steps = path.nodes().map(n => n.data('label')).join(' → ');
    pathResult.innerHTML = `<strong style="color:var(--success)">Route found: ${nodeCount - 1} hop(s)</strong><br>${steps}`;
  }

  pathBtn.addEventListener('click', findPath);
  pathClear.addEventListener('click', () => {
    cy.elements().removeClass('path-edge path-node selected neighbor faded highlighted');
    pathFrom.value = '';
    pathTo.value = '';
    resetInfo();
  });

  cyZoomIn.addEventListener('click', () => cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
  cyZoomOut.addEventListener('click', () => cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
  cyFitBtn.addEventListener('click', () => cy.fit(cy.nodes(), 60));
})();
