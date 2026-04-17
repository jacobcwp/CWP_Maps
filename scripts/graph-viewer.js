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
  const pathModeBtn = document.getElementById('path-mode-btn');
  const editModeBtn = document.getElementById('edit-mode-btn');
  const analyzeModeBtn = document.getElementById('analyze-mode-btn');
  const connectBtn = document.getElementById('connect-btn');
  const deleteEdgeBtn = document.getElementById('delete-edge-btn');
  const editNodeBtn = document.getElementById('edit-node-btn');
  const exportBtn = document.getElementById('export-btn');
  const runAnalysisBtn = document.getElementById('run-analysis-btn');
  const simulateTrafficBtn = document.getElementById('simulate-traffic-btn');
  const heatmapCombinedBtn = document.getElementById('heatmap-combined-btn');
  const heatmapTrafficBtn = document.getElementById('heatmap-traffic-btn');
  const resetStylesBtn = document.getElementById('reset-styles-btn');
  const analyzeActionPanel = document.getElementById('analyze-action-panel');
  const analysisBody = document.getElementById('analysis-body');

  if (!infoBody || !pathFrom || !pathTo || !pathBtn || !pathClear || !pathResult || !cyZoomIn || !cyZoomOut || !cyFitBtn || !pathModeBtn || !editModeBtn || !analyzeModeBtn || !connectBtn || !deleteEdgeBtn || !editNodeBtn || !exportBtn || !runAnalysisBtn || !simulateTrafficBtn || !heatmapCombinedBtn || !heatmapTrafficBtn || !resetStylesBtn || !analyzeActionPanel || !analysisBody) {
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

  window.graphCy = cy;

  // Build a bridge from cytoscape edge IDs (e0, e1, ...) to analytics edge IDs (edge_src_tgt_idx).
  // graph-analytics.js already ran and built its model from window.graphEdges *before* graph-viewer
  // overwrote them with simple e0/e1 IDs. We rebuild the lookup here by matching source/target pairs.
  function buildEdgeIdBridge() {
    const bridge = new Map(); // cy edge id -> analytics edge id
    if (!window.GraphAnalysis) return bridge;
    const analyticsEdges = window.GraphAnalysis.graph.edges; // has source, target, id
    cy.edges().forEach(cyEdge => {
      const src = cyEdge.data('source');
      const tgt = cyEdge.data('target');
      const match = analyticsEdges.find(ae =>
        (ae.source === src && ae.target === tgt) ||
        (ae.source === tgt && ae.target === src)
      );
      if (match) bridge.set(cyEdge.id(), match.id);
    });
    return bridge;
  }

  // Apply heatmap colors to the cy instance using correct IDs.
  function applyCyHeatmap(nodeHeatMap, edgeHeatMap, edgeBridge) {
    cy.nodes().forEach(node => {
      const h = nodeHeatMap[node.id()];
      if (h) {
        node.style('background-color', h.color);
        node.style('border-color', h.color);
      }
    });
    cy.edges().forEach(edge => {
      const analyticsId = edgeBridge.get(edge.id());
      const h = analyticsId ? edgeHeatMap[analyticsId] : null;
      if (h) {
        edge.style('line-color', h.color);
        edge.style('width', 1.5 + h.value * 3);
      }
    });
  }

  window.applyGraphHeatmap = function(options = {}) {
    if (!window.GraphAnalysis || !window.graphCy) {
      console.warn('GraphAnalysis or graphCy is not available yet.');
      return;
    }
    const bridge = buildEdgeIdBridge();
    const nodeHeat = window.GraphAnalysis.getNodeHeat(options.nodeField || 'combined');
    const edgeHeat = window.GraphAnalysis.getEdgeHeat(options.edgeField || 'combined');
    applyCyHeatmap(nodeHeat, edgeHeat, bridge);
  };

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

  function renderAnalysisBody(data) {
    if (!analysisBody) return;
    const sections = [];
    if (data.topChokePoints) {
      sections.push('<div><strong>Top choke points</strong><ul>' + data.topChokePoints.map(item => `<li>${item.label} (${item.type})</li>`).join('') + '</ul></div>');
    }
    if (data.topDefensivePositions) {
      sections.push('<div><strong>Defensive positions</strong><ul>' + data.topDefensivePositions.map(item => `<li>${item.label} (${item.type})</li>`).join('') + '</ul></div>');
    }
    if (data.mostUsedTunnels) {
      sections.push('<div><strong>Top tunnels</strong><ul>' + data.mostUsedTunnels.map(item => `<li>${item.source} → ${item.target}</li>`).join('') + '</ul></div>');
    }
    if (data.criticalInfrastructureNodes) {
      sections.push('<div><strong>Critical infrastructure</strong><ul>' + data.criticalInfrastructureNodes.map(item => `<li>${item.label} (${item.type})</li>`).join('') + '</ul></div>');
    }
    if (!sections.length) {
      analysisBody.innerHTML = '<div class="info-empty">No analysis data available.</div>';
      return;
    }
    analysisBody.innerHTML = sections.join('');
  }

  function runGraphAnalysis() {
    if (!window.GraphAnalysis) {
      alert('Graph analysis is not loaded yet.');
      return;
    }
    window.GraphAnalysis.computeCentrality();
    const ranked = window.GraphAnalysis.getRankedLists({ maxItems: 5 });
    renderAnalysisBody(ranked);
    // Color nodes by betweenness centrality (choke-point heatmap, no traffic needed)
    const bridge = buildEdgeIdBridge();
    const nodeHeat = window.GraphAnalysis.getNodeHeat('betweenness');
    const edgeHeat = window.GraphAnalysis.getEdgeHeat('betweenness');
    applyCyHeatmap(nodeHeat, edgeHeat, bridge);
  }

  function simulateGraphTraffic() {
    if (!window.GraphAnalysis) {
      alert('Graph analysis is not loaded yet.');
      return;
    }
    window.GraphAnalysis.simulateTraffic({ agentCount: 30, steps: 180 });
    window.GraphAnalysis.getHeatmaps();
    const ranked = window.GraphAnalysis.getRankedLists({ maxItems: 5 });
    renderAnalysisBody(ranked);
    // Color nodes/edges by traffic volume
    const bridge = buildEdgeIdBridge();
    const nodeHeat = window.GraphAnalysis.getNodeHeat('traffic');
    const edgeHeat = window.GraphAnalysis.getEdgeHeat('traffic');
    applyCyHeatmap(nodeHeat, edgeHeat, bridge);
  }

  function applyHeatmapCombined() {
    if (!window.GraphAnalysis) {
      alert('Graph analysis is not loaded yet.');
      return;
    }
    const bridge = buildEdgeIdBridge();
    const nodeHeat = window.GraphAnalysis.getNodeHeat('combined');
    const edgeHeat = window.GraphAnalysis.getEdgeHeat('combined');
    applyCyHeatmap(nodeHeat, edgeHeat, bridge);
  }

  function applyHeatmapTraffic() {
    if (!window.GraphAnalysis) {
      alert('Graph analysis is not loaded yet.');
      return;
    }
    const bridge = buildEdgeIdBridge();
    const nodeHeat = window.GraphAnalysis.getNodeHeat('traffic');
    const edgeHeat = window.GraphAnalysis.getEdgeHeat('traffic');
    applyCyHeatmap(nodeHeat, edgeHeat, bridge);
  }

  function resetGraphStyles() {
    cy.elements().removeStyle();
    cy.edges().style('line-color', '#1a4a6e');
    cy.nodes().forEach(node => {
      node.style('background-color', typeColors[node.data('type')]?.bg || '#1a3a5c');
      node.style('border-color', typeColors[node.data('type')]?.border || '#2a5a8c');
    });
  }

  const analyzeModeButtons = [runAnalysisBtn, simulateTrafficBtn, heatmapCombinedBtn, heatmapTrafficBtn, resetStylesBtn];
  let analyzeModeActive = false;

  function setAnalyzeMode(active) {
    analyzeModeActive = active;
    analyzeModeBtn.textContent = active ? 'Exit Analyze' : 'Analyze Mode';
    analyzeModeBtn.style.background = active ? '#66ccff' : '';
    analyzeActionPanel.style.display = active ? 'block' : 'none';
    analyzeModeButtons.forEach(btn => {
      btn.style.display = active ? 'inline-flex' : 'none';
      btn.style.opacity = active ? '1' : '0';
      btn.style.pointerEvents = active ? 'auto' : 'none';
    });
    if (!active) {
      analysisBody.innerHTML = '<div class="info-empty">Press Analyze or Simulate to show ranked choke points, defensive positions, and tunnel usage.</div>';
    }
  }

  runAnalysisBtn.onclick = runGraphAnalysis;
  simulateTrafficBtn.onclick = simulateGraphTraffic;
  heatmapCombinedBtn.onclick = applyHeatmapCombined;
  heatmapTrafficBtn.onclick = applyHeatmapTraffic;
  resetStylesBtn.onclick = resetGraphStyles;
  analyzeModeBtn.onclick = function() {
    if (editModeActive) {
      setEditMode(false);
    }
    setAnalyzeMode(!analyzeModeActive);
  };

  setAnalyzeMode(false);

  // Add connect, delete edge and edit node buttons
  let connectMode = false;
  let connectNodes = [];
  let deleteEdgeMode = false;
  let deleteEdgeNodes = [];
  let editNodeMode = false;
  let editTarget = null;
  let pathMode = false;
  let pathModeNodes = [];
  let editModeActive = false;
  const editActionButtons = [connectBtn, deleteEdgeBtn, editNodeBtn];

  connectBtn.onclick = function() {
    if (!editModeActive) {
      return;
    }
    connectMode = !connectMode;
    deleteEdgeMode = false;
    pathMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    pathModeNodes = [];
    connectBtn.textContent = connectMode ? 'Cancel Connect' : 'Connect Nodes';
    connectBtn.style.background = connectMode ? '#ffaa00' : '';
    deleteEdgeBtn.textContent = 'Delete Edge';
    deleteEdgeBtn.style.background = '';
    pathModeBtn.textContent = 'Path Mode';
    pathModeBtn.style.background = '';
  };

  deleteEdgeBtn.onclick = function() {
    if (!editModeActive) {
      return;
    }
    deleteEdgeMode = !deleteEdgeMode;
    connectMode = false;
    editNodeMode = false;
    pathMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    pathModeNodes = [];
    editTarget = null;
    deleteEdgeBtn.textContent = deleteEdgeMode ? 'Cancel Delete' : 'Delete Edge';
    deleteEdgeBtn.style.background = deleteEdgeMode ? '#ff6666' : '';
    connectBtn.textContent = 'Connect Nodes';
    connectBtn.style.background = '';
    editNodeBtn.textContent = 'Edit Node';
    editNodeBtn.style.background = '';
    pathModeBtn.textContent = 'Path Mode';
    pathModeBtn.style.background = '';
  };

  editNodeBtn.onclick = function() {
    if (!editModeActive) {
      return;
    }
    editNodeMode = !editNodeMode;
    connectMode = false;
    deleteEdgeMode = false;
    pathMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    pathModeNodes = [];
    editTarget = null;
    editNodeBtn.textContent = editNodeMode ? 'Cancel Edit' : 'Edit Node';
    editNodeBtn.style.background = editNodeMode ? '#66ccff' : '';
    connectBtn.textContent = 'Connect Nodes';
    connectBtn.style.background = '';
    deleteEdgeBtn.textContent = 'Delete Edge';
    deleteEdgeBtn.style.background = '';
    pathModeBtn.textContent = 'Path Mode';
    pathModeBtn.style.background = '';
  };

  pathModeBtn.onclick = function() {
    pathMode = !pathMode;
    connectMode = false;
    deleteEdgeMode = false;
    editNodeMode = false;
    connectNodes = [];
    deleteEdgeNodes = [];
    pathModeNodes = [];
    editTarget = null;
    pathModeBtn.textContent = pathMode ? 'Cancel Path' : 'Path Mode';
    pathModeBtn.style.background = pathMode ? '#66ccff' : '';
    connectBtn.textContent = 'Connect Nodes';
    connectBtn.style.background = '';
    deleteEdgeBtn.textContent = 'Delete Edge';
    deleteEdgeBtn.style.background = '';
    editNodeBtn.textContent = 'Edit Node';
    editNodeBtn.style.background = '';
    if (pathMode) {
      pathResult.textContent = 'Click the start node, then the end node.';
    } else {
      pathResult.textContent = 'Select two nodes to find a route.';
    }
  };

  editModeBtn.onclick = function() {
    if (!editModeActive && analyzeModeActive) {
      setAnalyzeMode(false);
    }
    setEditMode(!editModeActive);
    if (editModeActive) {
      pathMode = false;
      pathModeNodes = [];
      pathModeBtn.textContent = 'Path Mode';
      pathModeBtn.style.background = '';
      pathResult.textContent = 'Edit mode active — choose an edit action.';
    } else {
      resetInfo();
    }
  };

  function setEditMode(active) {
    if (active && analyzeModeActive) {
      setAnalyzeMode(false);
    }
    editModeActive = active;
    editModeBtn.textContent = active ? 'Exit Edit Mode' : 'Edit Mode';
    editModeBtn.style.background = active ? '#66ccff' : '';
    editActionButtons.forEach(btn => {
      btn.style.display = active ? 'inline-flex' : 'none';
      btn.style.opacity = active ? '1' : '0';
      btn.style.pointerEvents = active ? 'auto' : 'none';
    });
    if (!active) {
      connectMode = false;
      deleteEdgeMode = false;
      editNodeMode = false;
      connectNodes = [];
      deleteEdgeNodes = [];
      editTarget = null;
      connectBtn.textContent = 'Connect Nodes';
      connectBtn.style.background = '';
      deleteEdgeBtn.textContent = 'Delete Edge';
      deleteEdgeBtn.style.background = '';
      editNodeBtn.textContent = 'Edit Node';
      editNodeBtn.style.background = '';
    }
  }

  setEditMode(false);

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

    if (pathMode) {
      pathModeNodes.push(node);
      if (pathModeNodes.length === 1) {
        cy.elements().removeClass('selected neighbor faded highlighted path-edge path-node');
        node.addClass('selected');
        pathResult.textContent = `Start selected: ${data.label}. Now click the end node.`;
        return;
      }

      const source = pathModeNodes[0].id();
      const target = node.id();
      if (source === target) {
        pathModeNodes = [];
        pathResult.textContent = 'Choose a different end node.';
        return;
      }
      findPathByIds(source, target);
      pathMode = false;
      pathModeNodes = [];
      pathModeBtn.textContent = 'Path Mode';
      pathModeBtn.style.background = '';
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
      if (pathMode) {
        pathMode = false;
        pathModeNodes = [];
        pathModeBtn.textContent = 'Path Mode';
        pathModeBtn.style.background = '';
      }
    }
  });

  function highlightPath(path) {
    cy.elements().removeClass('path-edge path-node selected neighbor faded highlighted');
    if (path.length === 0) {
      pathResult.textContent = '⚠ No route found between these nodes.';
      return false;
    }

    cy.elements().not(path).addClass('faded');
    path.nodes().addClass('path-node');
    path.edges().addClass('path-edge');

    const nodeCount = path.nodes().length;
    const steps = path.nodes().map(n => n.data('label')).join(' → ');
    pathResult.innerHTML = `<strong style="color:var(--success)">Route found: ${nodeCount - 1} hop(s)</strong><br>${steps}`;
    return true;
  }

  function findPathByIds(fromId, toId) {
    if (!fromId || !toId) {
      pathResult.textContent = 'Select both From and To nodes.';
      return;
    }
    if (fromId === toId) {
      pathResult.textContent = 'From and To must be different nodes.';
      return;
    }

    const dijkstra = cy.elements().dijkstra({ root: `#${fromId}`, directed: false });
    const pathToNode = cy.$(`#${toId}`);
    const path = dijkstra.pathTo(pathToNode);
    highlightPath(path);
  }

  function findPath() {
    findPathByIds(pathFrom.value, pathTo.value);
  }

  pathBtn.addEventListener('click', findPath);
  pathClear.addEventListener('click', () => {
    cy.elements().removeClass('path-edge path-node selected neighbor faded highlighted');
    pathFrom.value = '';
    pathTo.value = '';
    pathMode = false;
    pathModeNodes = [];
    pathModeBtn.textContent = 'Path Mode';
    pathModeBtn.style.background = '';
    resetInfo();
  });

  cyZoomIn.addEventListener('click', () => cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
  cyZoomOut.addEventListener('click', () => cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
  cyFitBtn.addEventListener('click', () => cy.fit(cy.nodes(), 60));
})();