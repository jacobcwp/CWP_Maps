(function() {
  const nodes = window.graphNodes || [];
  const rawEdges = window.graphEdges || [];

  const nodeHeat = {};
  const edgeHeat = {};

  function euclideanDistance(a, b) {
    if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) {
      return Infinity;
    }
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function pairKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  class MinHeap {
    constructor() { this.data = []; }
    push(item) {
      this.data.push(item);
      let idx = this.data.length - 1;
      while (idx > 0) {
        const parent = Math.floor((idx - 1) / 2);
        if (this.data[parent].priority <= this.data[idx].priority) break;
        [this.data[parent], this.data[idx]] = [this.data[idx], this.data[parent]];
        idx = parent;
      }
    }
    pop() {
      if (!this.data.length) return null;
      const top = this.data[0];
      const last = this.data.pop();
      if (this.data.length) {
        this.data[0] = last;
        let idx = 0;
        while (true) {
          const left = idx * 2 + 1;
          const right = idx * 2 + 2;
          let smallest = idx;
          if (left < this.data.length && this.data[left].priority < this.data[smallest].priority) smallest = left;
          if (right < this.data.length && this.data[right].priority < this.data[smallest].priority) smallest = right;
          if (smallest === idx) break;
          [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
          idx = smallest;
        }
      }
      return top;
    }
    get size() { return this.data.length; }
  }

  function buildGraphModel(nodeList, rawEdgeList) {
    const nodesById = new Map();
    nodeList.forEach(node => {
      nodesById.set(node.id, Object.assign({}, node));
    });

    const edges = [];
    const edgesById = new Map();
    const edgeKeyToId = new Map();

    rawEdgeList.forEach((edge, idx) => {
      let source;
      let target;
      let id;
      if (Array.isArray(edge)) {
        [source, target] = edge;
        id = `edge_${source}_${target}_${idx}`;
      } else {
        source = edge.source;
        target = edge.target;
        id = edge.id || `edge_${source}_${target}_${idx}`;
      }
      if (!source || !target || !nodesById.has(source) || !nodesById.has(target)) {
        return;
      }
      const sourceNode = nodesById.get(source);
      const targetNode = nodesById.get(target);
      const weight = euclideanDistance(sourceNode.pos, targetNode.pos);
      const edgeObj = { id, source, target, weight };
      edges.push(edgeObj);
      edgesById.set(id, edgeObj);
      edgeKeyToId.set(pairKey(source, target), id);
    });

    const adjacency = new Map();
    nodeList.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
      adjacency.get(edge.source).push({ neighbor: edge.target, edgeId: edge.id, weight: edge.weight });
      adjacency.get(edge.target).push({ neighbor: edge.source, edgeId: edge.id, weight: edge.weight });
    });

    const keyTypes = new Set(['reactor', 'elevator', 'key']);
    const keyNodes = nodeList.filter(node => keyTypes.has(node.type)).map(node => node.id);

    return {
      nodes: nodeList.slice(),
      edges,
      nodesById,
      edgesById,
      adjacency,
      edgeKeyToId,
      keyNodes,
      nodeCount: nodeList.length,
      edgeCount: edges.length,
    };
  }

  function dijkstra(graph, sourceId) {
    if (!graph.nodesById.has(sourceId)) {
      return null;
    }
    const distances = new Map();
    const previous = new Map();
    const previousEdge = new Map();
    const queue = new MinHeap();

    graph.nodes.forEach(node => {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
      previousEdge.set(node.id, null);
    });

    distances.set(sourceId, 0);
    queue.push({ id: sourceId, priority: 0 });

    while (queue.size) {
      const item = queue.pop();
      if (!item) break;
      const currentId = item.id;
      const currentDist = item.priority;
      if (currentDist > distances.get(currentId)) continue;

      const neighbors = graph.adjacency.get(currentId) || [];
      neighbors.forEach(entry => {
        const alt = currentDist + entry.weight;
        if (alt < distances.get(entry.neighbor)) {
          distances.set(entry.neighbor, alt);
          previous.set(entry.neighbor, currentId);
          previousEdge.set(entry.neighbor, entry.edgeId);
          queue.push({ id: entry.neighbor, priority: alt });
        }
      });
    }

    return { distances, previous, previousEdge };
  }

  function shortestPath(graph, sourceId, targetId) {
    if (!graph.nodesById.has(sourceId) || !graph.nodesById.has(targetId)) {
      return { nodes: [], edges: [], distance: Infinity };
    }
    const result = dijkstra(graph, sourceId);
    if (!result) {
      return { nodes: [], edges: [], distance: Infinity };
    }
    const { distances, previous, previousEdge } = result;
    const path = [];
    const pathEdges = [];
    let current = targetId;
    if (distances.get(targetId) === Infinity) {
      return { nodes: [], edges: [], distance: Infinity };
    }
    while (current) {
      path.unshift(current);
      const edgeId = previousEdge.get(current);
      if (edgeId) {
        pathEdges.unshift(edgeId);
      }
      current = previous.get(current);
    }
    return {
      source: sourceId,
      target: targetId,
      distance: distances.get(targetId),
      nodes: path,
      edges: pathEdges,
      nodeObjects: path.map(id => graph.nodesById.get(id)),
      edgeObjects: pathEdges.map(id => graph.edgesById.get(id)),
    };
  }

  function computeDegreeCentrality(graph) {
    const degree = new Map();
    const degreeCentrality = new Map();
    graph.nodes.forEach(node => {
      const deg = (graph.adjacency.get(node.id) || []).length;
      degree.set(node.id, deg);
      degreeCentrality.set(node.id, graph.nodeCount > 1 ? deg / (graph.nodeCount - 1) : 0);
    });
    return { degree, degreeCentrality };
  }

  function computeClosenessCentrality(graph) {
    const closeness = new Map();
    graph.nodes.forEach(node => {
      const result = dijkstra(graph, node.id);
      if (!result) {
        closeness.set(node.id, 0);
        return;
      }
      const totalDistance = Array.from(result.distances.values()).reduce((sum, d) => (d === Infinity ? sum : sum + d), 0);
      const reachable = Array.from(result.distances.values()).filter(d => d < Infinity).length - 1;
      if (totalDistance === 0 || reachable <= 0) {
        closeness.set(node.id, 0);
        return;
      }
      closeness.set(node.id, reachable / totalDistance);
    });
    return closeness;
  }

  function computeBetweennessCentrality(graph) {
    const nodeBC = new Map(graph.nodes.map(node => [node.id, 0]));
    const edgeBC = new Map(graph.edges.map(edge => [edge.id, 0]));

    graph.nodes.forEach(sourceNode => {
      const source = sourceNode.id;
      const stack = [];
      const predecessors = new Map(graph.nodes.map(node => [node.id, []]));
      const sigma = new Map(graph.nodes.map(node => [node.id, 0]));
      const dist = new Map(graph.nodes.map(node => [node.id, Infinity]));
      const queue = new MinHeap();

      sigma.set(source, 1);
      dist.set(source, 0);
      queue.push({ id: source, priority: 0 });

      while (queue.size) {
        const element = queue.pop();
        if (!element) break;
        const v = element.id;
        const vDist = element.priority;
        if (vDist > dist.get(v)) continue;
        stack.push(v);

        const neighbors = graph.adjacency.get(v) || [];
        neighbors.forEach(({ neighbor: w, weight }) => {
          const alt = vDist + weight;
          if (alt < dist.get(w)) {
            dist.set(w, alt);
            queue.push({ id: w, priority: alt });
            sigma.set(w, sigma.get(v));
            predecessors.set(w, [v]);
          } else if (alt === dist.get(w)) {
            sigma.set(w, sigma.get(w) + sigma.get(v));
            predecessors.get(w).push(v);
          }
        });
      }

      const delta = new Map(graph.nodes.map(node => [node.id, 0]));
      while (stack.length) {
        const w = stack.pop();
        const coeff = (1 + delta.get(w)) / sigma.get(w);
        predecessors.get(w).forEach(v => {
          const edgeId = graph.edgeKeyToId.get(pairKey(v, w));
          if (edgeId) {
            edgeBC.set(edgeId, edgeBC.get(edgeId) + sigma.get(v) * coeff);
          }
          const value = sigma.get(v) * coeff;
          delta.set(v, delta.get(v) + value);
        });
        if (w !== source) {
          nodeBC.set(w, nodeBC.get(w) + delta.get(w));
        }
      }
    });

    const normalizeFactor = graph.nodeCount > 2 ? 1 / ((graph.nodeCount - 1) * (graph.nodeCount - 2) / 2) : 1;
    const normalizedNodeBC = new Map();
    const normalizedEdgeBC = new Map();
    nodeBC.forEach((value, id) => normalizedNodeBC.set(id, value * normalizeFactor));
    edgeBC.forEach((value, id) => normalizedEdgeBC.set(id, value * normalizeFactor));

    return { betweenness: normalizedNodeBC, edgeBetweenness: normalizedEdgeBC };
  }

  function normalizeMapValues(valueMap) {
    const values = Array.from(valueMap.values()).filter(v => typeof v === 'number');
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const normalized = new Map();
    const range = max - min || 1;
    valueMap.forEach((value, id) => {
      normalized.set(id, (value - min) / range);
    });
    return { normalized, min, max };
  }

  function createHeatmap(graph, analysis, traffic = null) {
    const { betweenness, edgeBetweenness } = analysis;
    const { normalized: nodeBetweennessNorm } = normalizeMapValues(betweenness);
    const { normalized: degreeNorm } = normalizeMapValues(analysis.degreeCentrality);
    const { normalized: closenessNorm } = normalizeMapValues(analysis.closeness);
    const nodeTraffic = traffic && traffic.nodeCounts ? new Map(Object.entries(traffic.nodeCounts)) : new Map();
    const edgeTraffic = traffic && traffic.edgeCounts ? new Map(Object.entries(traffic.edgeCounts)) : new Map();
    const { normalized: nodeTrafficNorm } = normalizeMapValues(new Map(Array.from(nodeTraffic.entries()).map(([id, value]) => [id, value || 0])));
    const { normalized: edgeTrafficNorm } = normalizeMapValues(new Map(Array.from(edgeTraffic.entries()).map(([id, value]) => [id, value || 0])));

    const nodeHeatResult = {};
    graph.nodes.forEach(node => {
      const trafficValue = nodeTrafficNorm.get(node.id) || 0;
      const betweennessValue = nodeBetweennessNorm.get(node.id) || 0;
      const defenseBonus = node.type === 'defense' ? 0.2 : 0;
      const defenseScore = Math.min(1, betweennessValue * 0.55 + degreeNorm.get(node.id) * 0.25 + defenseBonus);
      const combined = Math.min(1, trafficValue * 0.6 + betweennessValue * 0.4 + defenseBonus * 0.2);
      nodeHeatResult[node.id] = {
        traffic: trafficValue,
        betweenness: betweennessValue,
        closeness: closenessNorm.get(node.id) || 0,
        defense: defenseScore,
        combined,
        degree: degreeNorm.get(node.id) || 0,
        label: node.label,
        type: node.type,
      };
    });

    const edgeHeatResult = {};
    graph.edges.forEach(edge => {
      const trafficValue = edgeTrafficNorm.get(edge.id) || 0;
      const betweennessValue = edgeBetweenness.get(edge.id) || 0;
      edgeHeatResult[edge.id] = {
        traffic: trafficValue,
        betweenness: betweennessValue,
        combined: Math.min(1, trafficValue * 0.7 + betweennessValue * 0.5),
        source: edge.source,
        target: edge.target,
      };
    });

    return { nodeHeatResult, edgeHeatResult };
  }

  function randomChoice(array) {
    if (!array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  function pickNextTarget(current, keyNodes) {
    const candidates = keyNodes.filter(id => id !== current);
    return randomChoice(candidates);
  }

  function simulateTraffic(graph, options = {}) {
    const agentCount = Number(options.agentCount || 20);
    const steps = Number(options.steps || 200);
    const keyNodes = options.keyTypes ? graph.nodes.filter(node => options.keyTypes.includes(node.type)).map(node => node.id) : graph.keyNodes.slice();
    const trafficNodeCounts = new Map(graph.nodes.map(node => [node.id, 0]));
    const trafficEdgeCounts = new Map(graph.edges.map(edge => [edge.id, 0]));

    if (!keyNodes.length) {
      return { nodeCounts: {}, edgeCounts: {} };
    }

    const agents = Array.from({ length: agentCount }, () => {
      const current = randomChoice(keyNodes);
      const target = pickNextTarget(current, keyNodes) || current;
      const path = shortestPath(graph, current, target);
      return {
        current,
        target,
        path: path.nodes.slice(1),
        edgePath: path.edges.slice(),
      };
    });

    agents.forEach(agent => trafficNodeCounts.set(agent.current, trafficNodeCounts.get(agent.current) + 1));

    for (let step = 0; step < steps; step += 1) {
      agents.forEach(agent => {
        if (!agent.path.length || agent.current === agent.target) {
          agent.target = pickNextTarget(agent.current, keyNodes) || agent.current;
          const path = shortestPath(graph, agent.current, agent.target);
          agent.path = path.nodes.slice(1);
          agent.edgePath = path.edges.slice();
        }
        if (!agent.path.length) {
          return;
        }
        const nextNodeId = agent.path.shift();
        const nextEdgeId = agent.edgePath.shift();
        if (nextEdgeId) {
          trafficEdgeCounts.set(nextEdgeId, trafficEdgeCounts.get(nextEdgeId) + 1);
        }
        agent.current = nextNodeId;
        trafficNodeCounts.set(agent.current, trafficNodeCounts.get(agent.current) + 1);
      });
    }

    const nodeCountsObject = Object.fromEntries(trafficNodeCounts.entries());
    const edgeCountsObject = Object.fromEntries(trafficEdgeCounts.entries());
    return { nodeCounts: nodeCountsObject, edgeCounts: edgeCountsObject };
  }

  function sortMapEntries(map, compareFn) {
    return Array.from(map.entries()).sort((a, b) => compareFn(a[1], b[1], a[0], b[0]));
  }

  function scoreDefenseNode(graph, analysis, nodeId) {
    const bc = analysis.betweenness.get(nodeId) || 0;
    const degree = analysis.degreeCentrality.get(nodeId) || 0;
    const isDefense = graph.nodesById.get(nodeId).type === 'defense' ? 1 : 0;
    return bc * 0.55 + degree * 0.3 + isDefense * 0.15;
  }

  function getRankedLists(graph, analysis, traffic = null, maxItems = 10) {
    const trafficNodeCounts = traffic && traffic.nodeCounts ? new Map(Object.entries(traffic.nodeCounts)) : new Map();
    const trafficEdgeCounts = traffic && traffic.edgeCounts ? new Map(Object.entries(traffic.edgeCounts)) : new Map();

    const nodeScore = new Map();
    graph.nodes.forEach(node => {
      const betweenness = analysis.betweenness.get(node.id) || 0;
      const degree = analysis.degreeCentrality.get(node.id) || 0;
      const trafficValue = trafficNodeCounts.get(node.id) || 0;
      nodeScore.set(node.id, betweenness * 0.6 + degree * 0.25 + Math.min(1, trafficValue / 50) * 0.15);
    });

    const sortedNodesByBetweenness = sortMapEntries(analysis.betweenness, (a, b) => b - a).slice(0, maxItems);
    const topChokePoints = sortedNodesByBetweenness.map(([nodeId, score]) => ({ id: nodeId, label: graph.nodesById.get(nodeId).label, type: graph.nodesById.get(nodeId).type, score }));

    const defenseNodes = graph.nodes.filter(node => node.type === 'defense');
    const sortedDefense = defenseNodes
      .map(node => ({ id: node.id, label: node.label, type: node.type, score: scoreDefenseNode(graph, analysis, node.id) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems);

    const sortedEdgesByTraffic = Array.from(trafficEdgeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([edgeId, count]) => ({ id: edgeId, count, source: graph.edgesById.get(edgeId).source, target: graph.edgesById.get(edgeId).target }));

    const sortedEdgesByBetweenness = sortMapEntries(analysis.edgeBetweenness, (a, b) => b - a).slice(0, maxItems).map(([edgeId, score]) => ({ id: edgeId, score, source: graph.edgesById.get(edgeId).source, target: graph.edgesById.get(edgeId).target }));
    const mostUsedTunnels = sortedEdgesByTraffic.length ? sortedEdgesByTraffic : sortedEdgesByBetweenness;

    const criticalNodes = graph.nodes
      .filter(node => ['reactor', 'elevator', 'key'].includes(node.type))
      .map(node => ({ id: node.id, label: node.label, type: node.type, score: (analysis.betweenness.get(node.id) || 0) + (analysis.degreeCentrality.get(node.id) || 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems);

    return {
      topChokePoints,
      topDefensivePositions: sortedDefense,
      mostUsedTunnels,
      criticalInfrastructureNodes: criticalNodes,
      edgeBetweennessTop: sortedEdgesByBetweenness,
    };
  }

  function heatColor(value, min = 0, max = 1) {
    const normalized = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
    const red = Math.round(255 * normalized);
    const green = Math.round(50 + 205 * (1 - normalized));
    const blue = Math.round(50 + 205 * (1 - normalized));
    return `rgb(${red}, ${green}, ${blue})`;
  }

  function getNodeHeat(graph, analysis, traffic, type = 'combined') {
    const heatData = createHeatmap(graph, analysis, traffic).nodeHeatResult;
    const result = {};
    Object.entries(heatData).forEach(([id, payload]) => {
      const value = payload[type] != null ? payload[type] : payload.combined;
      result[id] = { value, color: heatColor(value), meta: payload };
    });
    return result;
  }

  function getEdgeHeat(graph, analysis, traffic, type = 'combined') {
    const heatData = createHeatmap(graph, analysis, traffic).edgeHeatResult;
    const result = {};
    Object.entries(heatData).forEach(([id, payload]) => {
      const value = payload[type] != null ? payload[type] : payload.combined;
      result[id] = { value, color: heatColor(value), meta: payload };
    });
    return result;
  }

  function applyCytoscapeHeatmap(cy, graph, analysis, traffic, options = {}) {
    const nodeField = options.nodeField || 'combined';
    const edgeField = options.edgeField || 'combined';
    const nodeHeatMap = getNodeHeat(graph, analysis, traffic, nodeField);
    const edgeHeatMap = getEdgeHeat(graph, analysis, traffic, edgeField);

    cy.nodes().forEach(node => {
      const id = node.id();
      if (nodeHeatMap[id]) {
        node.style('background-color', nodeHeatMap[id].color);
      }
    });
    cy.edges().forEach(edge => {
      const id = edge.id();
      if (edgeHeatMap[id]) {
        edge.style('line-color', edgeHeatMap[id].color);
      }
    });
  }

  function summary(graph, analysis, traffic) {
    const ranked = getRankedLists(graph, analysis, traffic, 5);
    return {
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      keyNodeCount: graph.keyNodes.length,
      topChokePoints: ranked.topChokePoints,
      topDefensivePositions: ranked.topDefensivePositions,
      mostUsedTunnels: ranked.mostUsedTunnels,
      criticalInfrastructureNodes: ranked.criticalInfrastructureNodes,
    };
  }

  const graphModel = buildGraphModel(nodes, rawEdges);
  const analysis = {
    ...computeDegreeCentrality(graphModel),
    closeness: computeClosenessCentrality(graphModel),
    ...computeBetweennessCentrality(graphModel),
  };

  const defaultTraffic = { nodeCounts: {}, edgeCounts: {} };
  const heatmaps = createHeatmap(graphModel, analysis, defaultTraffic);

  const GraphAnalysis = {
    graph: graphModel,
    analysis,
    defaultTraffic,
    heatmaps,
    nodeHeat,
    edgeHeat,
    init() {
      this.graph = graphModel;
      this.analysis = analysis;
      this.defaultTraffic = defaultTraffic;
      this.heatmaps = heatmaps;
      this.nodeHeat = nodeHeat;
      this.edgeHeat = edgeHeat;
      Object.assign(nodeHeat, heatmaps.nodeHeatResult);
      Object.assign(edgeHeat, heatmaps.edgeHeatResult);
      return this;
    },
    dijkstra(sourceId) {
      return dijkstra(this.graph, sourceId);
    },
    shortestPath(sourceId, targetId) {
      return shortestPath(this.graph, sourceId, targetId);
    },
    computeCentrality() {
      const degree = computeDegreeCentrality(this.graph);
      const closeness = computeClosenessCentrality(this.graph);
      const bc = computeBetweennessCentrality(this.graph);
      this.analysis = Object.assign({}, degree, { closeness }, bc);
      return this.analysis;
    },
    simulateTraffic(options = {}) {
      const traffic = simulateTraffic(this.graph, options);
      this.currentTraffic = traffic;
      return traffic;
    },
    getHeatmaps(options = {}) {
      const traffic = this.currentTraffic || this.defaultTraffic;
      const result = createHeatmap(this.graph, this.analysis, traffic);
      Object.assign(nodeHeat, result.nodeHeatResult);
      Object.assign(edgeHeat, result.edgeHeatResult);
      return result;
    },
    getNodeHeat(type = 'combined') {
      const traffic = this.currentTraffic || this.defaultTraffic;
      return getNodeHeat(this.graph, this.analysis, traffic, type);
    },
    getEdgeHeat(type = 'combined') {
      const traffic = this.currentTraffic || this.defaultTraffic;
      return getEdgeHeat(this.graph, this.analysis, traffic, type);
    },
    getRankedLists(options = {}) {
      const traffic = this.currentTraffic || this.defaultTraffic;
      return getRankedLists(this.graph, this.analysis, traffic, options.maxItems || 10);
    },
    applyCytoscapeHeatmap(cy, options = {}) {
      const traffic = this.currentTraffic || this.defaultTraffic;
      return applyCytoscapeHeatmap(cy, this.graph, this.analysis, traffic, options);
    },
    summary() {
      const traffic = this.currentTraffic || this.defaultTraffic;
      return summary(this.graph, this.analysis, traffic);
    },
  };

  GraphAnalysis.init();
  window.GraphAnalysis = GraphAnalysis;
  window.graphAnalysis = GraphAnalysis;
  window.nodeHeat = nodeHeat;
  window.edgeHeat = edgeHeat;
})();
