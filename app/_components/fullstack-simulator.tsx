"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ARCHITECTURE_PRESETS,
  applyScenario,
  autoLayout,
  buildNodeFromPalette,
  clamp,
  COMPONENT_LIBRARY,
  CLOUD_INSTANCE_OPTIONS,
  DEFAULT_ARCHITECTURE_ID,
  formatEndpoint,
  formatCompact,
  getArchitecturePreset,
  getCloudInstanceProfile,
  kindAppearance,
  parseEndpoint,
  percent,
  SCENARIOS,
  simulateNetwork,
  type ArchitectureEdge,
  type ConnectionSide,
  type ArchitectureNode,
  type FaultMode,
  type RequestMethod,
  type SavedDesign,
  type ScaleMode,
  type TrafficProfile,
} from "@/app/_lib/simulator";

const STORAGE_KEY = "fullstacksimulator.designs";
const WORKSPACE_KEY = "fullstacksimulator.workspace";
const CANVAS_WIDTH = 56000;
const CANVAS_HEIGHT = 32000;
const NODE_WIDTH = 184;
const NODE_HEIGHT = 216;
const NODE_CONNECTION_HANDLE_SIZE = 18;
const NODE_CONNECTION_HANDLE_OFFSET = 10;
const ROUTE_ROW_CENTER_OFFSET = 98;
const ROUTE_ROW_GAP = 26;
const MIN_ZOOM = 0.04;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 1.2;
const COMPACT_LAYOUT_WIDTH_THRESHOLD = 1900;
const COMPACT_LAYOUT_HEIGHT_THRESHOLD = 460;
const COMPACT_LAYOUT_X_SPREAD = 1.28;
const COMPACT_LAYOUT_Y_SPREAD = 1.42;
const DEFAULT_FIT_PADDING = 360;
const DEFAULT_FIT_ZOOM_FACTOR = 0.9;
const NODE_DRAG_CLICK_THRESHOLD = 6;

function getNodeBounds(nodes: ArchitectureNode[]) {
  if (nodes.length === 0) {
    return null;
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(NODE_WIDTH, maxX - minX),
    height: Math.max(NODE_HEIGHT, maxY - minY),
  };
}

function centerNodesOnCanvas(nodes: ArchitectureNode[]) {
  const expandedNodes = spreadCompactLayout(nodes);
  const bounds = getNodeBounds(expandedNodes);
  if (!bounds) {
    return expandedNodes;
  }

  const offsetX = CANVAS_WIDTH / 2 - bounds.width / 2 - bounds.minX;
  const offsetY = CANVAS_HEIGHT / 2 - bounds.height / 2 - bounds.minY;

  return expandedNodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
  }));
}

function spreadCompactLayout(nodes: ArchitectureNode[]) {
  const bounds = getNodeBounds(nodes);
  if (!bounds) {
    return nodes;
  }

  const shouldExpand =
    nodes.length >= 6 &&
    bounds.width <= COMPACT_LAYOUT_WIDTH_THRESHOLD &&
    bounds.height <= COMPACT_LAYOUT_HEIGHT_THRESHOLD;

  if (!shouldExpand) {
    return nodes;
  }

  return nodes.map((node) => ({
    ...node,
    x: bounds.minX + (node.x - bounds.minX) * COMPACT_LAYOUT_X_SPREAD,
    y: bounds.minY + (node.y - bounds.minY) * COMPACT_LAYOUT_Y_SPREAD,
  }));
}

function readSavedDesigns() {
  if (typeof window === "undefined") {
    return [] as SavedDesign[];
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [] as SavedDesign[];
  }

  try {
    return JSON.parse(saved) as SavedDesign[];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [] as SavedDesign[];
  }
}

function readWorkspace() {
  if (typeof window === "undefined") {
    return null;
  }

  const workspace = window.localStorage.getItem(WORKSPACE_KEY);
  if (!workspace) {
    return null;
  }

  try {
    return JSON.parse(workspace) as {
      architectureId?: string;
      nodes: ArchitectureNode[];
      edges: ArchitectureEdge[];
      traffic: TrafficProfile;
    };
  } catch {
    window.localStorage.removeItem(WORKSPACE_KEY);
    return null;
  }
}

function statusClasses(status: "healthy" | "degraded" | "failing") {
  if (status === "healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "degraded") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function metricValueClasses(status: "healthy" | "degraded" | "failing") {
  if (status === "healthy") {
    return "text-emerald-600";
  }
  if (status === "degraded") {
    return "text-amber-600";
  }
  return "text-rose-600";
}

function metricBarClass(status: "healthy" | "degraded" | "failing") {
  if (status === "healthy") {
    return "from-emerald-400 to-lime-400";
  }
  if (status === "degraded") {
    return "from-amber-400 to-orange-400";
  }
  return "from-rose-400 to-red-400";
}

function panelButtonClass(isActive = false) {
  return `rounded-full border px-3 py-2 text-xs font-medium transition ${
    isActive
      ? "border-slate-300 bg-slate-900 text-white shadow-sm"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
  }`;
}

function requestMethodClass(method: RequestMethod) {
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return "border-orange-200 bg-orange-50 text-orange-600";
  }

  if (method === "DELETE") {
    return "border-rose-200 bg-rose-50 text-rose-600";
  }

  if (method === "EVENT") {
    return "border-violet-200 bg-violet-50 text-violet-600";
  }

  return "border-blue-200 bg-blue-50 text-blue-600";
}

function routeSectionLabel(node: ArchitectureNode) {
  if (node.kind === "client") {
    return "Traffic Streams";
  }

  if (node.kind === "gateway") {
    return "Outputs";
  }

  return "Routes";
}

function requestDotCount(rps: number) {
  if (rps <= 0) {
    return 0;
  }

  const visibleRate = Math.min(rps, 18);
  const duration = 1.2;
  return Math.max(1, Math.min(18, Math.round(visibleRate * duration)));
}

function requestDotDuration(rps: number, speed: number) {
  if (rps <= 0) {
    return 1.2;
  }

  return Math.max(0.45, 1.2 / speed);
}

function getConnectionPoint(node: ArchitectureNode, side: ConnectionSide) {
  return {
    x: side === "left" ? node.x : node.x + NODE_WIDTH,
    y: node.y + NODE_HEIGHT / 2,
  };
}

function buildConnectionPath(
  startX: number,
  startY: number,
  startSide: ConnectionSide,
  endX: number,
  endY: number,
  endSide: ConnectionSide,
) {
  const horizontalDistance = Math.abs(endX - startX);
  const controlOffset = clamp(horizontalDistance * 0.45, 56, 180);
  const startControlX = startX + (startSide === "right" ? controlOffset : -controlOffset);
  const endControlX = endX + (endSide === "left" ? -controlOffset : controlOffset);

  return `M ${startX} ${startY} C ${startControlX} ${startY}, ${endControlX} ${endY}, ${endX} ${endY}`;
}

function buildReverseClientRoutePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
) {
  return `M ${targetX} ${targetY} C ${targetX - 90} ${targetY}, ${sourceX + 48} ${sourceY}, ${sourceX} ${sourceY}`;
}

export default function FullstackSimulator() {
  const initialArchitecture = getArchitecturePreset(
    DEFAULT_ARCHITECTURE_ID,
  );
  const seededScenario = applyScenario(
    "surge",
    centerNodesOnCanvas(initialArchitecture.nodes.map((node) => ({ ...node }))),
    initialArchitecture.traffic,
  );

  const [nodes, setNodes] = useState<ArchitectureNode[]>(
    () => centerNodesOnCanvas(seededScenario.nodes),
  );
  const [edges, setEdges] = useState<ArchitectureEdge[]>(() => initialArchitecture.edges);
  const [traffic, setTraffic] = useState<TrafficProfile>(() => seededScenario.traffic);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");
  const [connecting, setConnecting] = useState<{
    sourceNodeId: string;
    sourceSide: ConnectionSide;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [tick, setTick] = useState(0);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("surge");
  const [activeArchitectureId, setActiveArchitectureId] = useState<string>(
    DEFAULT_ARCHITECTURE_ID,
  );
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(true);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isScenarioMenuOpen, setIsScenarioMenuOpen] = useState(false);
  const hasCenteredInitialViewportRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const scenarioMenuRef = useRef<HTMLDivElement>(null);
  const nodeInspectorRef = useRef<HTMLDivElement>(null);
  const dragPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNodeClickRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const activeArchitecture = getArchitecturePreset(activeArchitectureId);
  const snapshot = simulateNetwork(nodes, edges, traffic);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const selectedMetrics = selectedNode
    ? snapshot.nodeMetrics[selectedNode.id]
    : undefined;
  const selectedRoutes = selectedNode ? snapshot.nodeRoutes[selectedNode.id] ?? [] : [];
  const selectedEdgeMetrics = selectedEdge
    ? snapshot.edgeMetrics[selectedEdge.id]
    : undefined;
  const selectedEdgeSource = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.source)
    : undefined;
  const selectedEdgeTarget = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.target)
    : undefined;
  const selectedCloudProfile = selectedNode
    ? getCloudInstanceProfile(selectedNode.instanceType)
    : null;
  const clientNodes = nodes.filter((node) => node.kind === "client");

  function getCanvasPointFromClient(clientX: number, clientY: number) {
    if (!canvasRef.current) {
      return null;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoomRef.current,
      y: (clientY - rect.top) / zoomRef.current,
    };
  }

  function createEdge(
    sourceNodeId: string,
    sourceSide: ConnectionSide,
    targetNodeId: string,
    targetSide: ConnectionSide,
  ) {
    if (sourceNodeId === targetNodeId) {
      return;
    }

    const alreadyExists = edges.some(
      (edge) =>
        edge.source === sourceNodeId &&
        edge.target === targetNodeId &&
        (edge.sourceSide ?? "right") === sourceSide &&
        (edge.targetSide ?? "left") === targetSide,
    );

    if (alreadyExists) {
      return;
    }

    const source = nodes.find((node) => node.id === sourceNodeId);
    if (!source) {
      return;
    }

    setEdges((current) => [
      ...current,
      {
        id: `edge-${sourceNodeId}-${sourceSide}-${targetNodeId}-${targetSide}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceSide,
        targetSide,
        label: source.kind === "queue" ? "async link" : "service call",
        protocol: source.kind === "queue" ? "async" : "sync",
        trafficShare: 1,
      },
    ]);
  }

  function centerViewportOnNodes(nextNodes: ArchitectureNode[], nextZoom = zoomRef.current) {
    if (!viewportRef.current) {
      return;
    }

    const bounds = getNodeBounds(nextNodes);
    if (!bounds) {
      return;
    }

    const contentCenterX = (bounds.minX + bounds.maxX) / 2;
    const contentCenterY = (bounds.minY + bounds.maxY) / 2;
    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;

    viewportRef.current.scrollLeft = Math.max(0, contentCenterX * nextZoom - viewportWidth / 2);
    viewportRef.current.scrollTop = Math.max(0, contentCenterY * nextZoom - viewportHeight / 2);
  }

  function fitViewportToNodes(nextNodes: ArchitectureNode[]) {
    if (!viewportRef.current) {
      return false;
    }

    const bounds = getNodeBounds(nextNodes);
    if (!bounds) {
      return false;
    }

    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    if (viewportWidth < 240 || viewportHeight < 240) {
      return false;
    }

    const padding = DEFAULT_FIT_PADDING;
    const fitZoom = clamp(
      Math.min(
        (viewportWidth - padding) / bounds.width,
        (viewportHeight - padding) / bounds.height,
      ) * DEFAULT_FIT_ZOOM_FACTOR,
      MIN_ZOOM,
      MAX_ZOOM,
    );

    setZoom(fitZoom);
    window.requestAnimationFrame(() => {
      centerViewportOnNodes(nextNodes, fitZoom);
    });
    return true;
  }

  function adjustZoom(nextZoom: number) {
    const viewport = viewportRef.current;
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    if (!viewport) {
      setZoom(clampedZoom);
      return;
    }

    const currentZoom = zoomRef.current;
    const anchorX = viewport.clientWidth / 2;
    const anchorY = viewport.clientHeight / 2;
    const worldX = (viewport.scrollLeft + anchorX) / currentZoom;
    const worldY = (viewport.scrollTop + anchorY) / currentZoom;

    setZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, worldX * clampedZoom - anchorX);
      viewport.scrollTop = Math.max(0, worldY * clampedZoom - anchorY);
    });
  }

  const syncWorkspace = useEffectEvent(
    (
      nextArchitectureId: string,
      nextNodes: ArchitectureNode[],
      nextEdges: ArchitectureEdge[],
      nextTraffic: TrafficProfile,
    ) => {
      window.localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify({
          architectureId: nextArchitectureId,
          nodes: nextNodes,
          edges: nextEdges,
          traffic: nextTraffic,
        }),
      );
    },
  );

  const syncDesigns = useEffectEvent((designs: SavedDesign[]) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
  });

  const deleteNode = useEffectEvent((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
    setSelectedNodeId((current) => (current === nodeId ? "" : current));
    setSelectedEdgeId((current) => {
      const edge = edges.find((item) => item.id === current);
      return edge && (edge.source === nodeId || edge.target === nodeId) ? "" : current;
    });
    setConnecting((current) => (current?.sourceNodeId === nodeId ? null : current));
  });

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setSelectedEdgeId((current) => (current === edgeId ? "" : current));
  }, []);

  useEffect(() => {
    const workspace = readWorkspace();
    const designs = readSavedDesigns();

    startTransition(() => {
      if (workspace) {
        setActiveArchitectureId(workspace.architectureId ?? DEFAULT_ARCHITECTURE_ID);
        setNodes(centerNodesOnCanvas(workspace.nodes));
        setEdges(workspace.edges);
        setTraffic(workspace.traffic);
        setSelectedEdgeId("");
        setConnecting(null);
      }

      setSavedDesigns(designs);
      setIsPersistenceReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isPersistenceReady) {
      return;
    }

    syncWorkspace(activeArchitectureId, nodes, edges, traffic);
  }, [activeArchitectureId, edges, isPersistenceReady, nodes, traffic]);

  useEffect(() => {
    if (!isPersistenceReady) {
      return;
    }

    syncDesigns(savedDesigns);
  }, [isPersistenceReady, savedDesigns]);

  useEffect(() => {
    if (hasCenteredInitialViewportRef.current || nodes.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      hasCenteredInitialViewportRef.current = fitViewportToNodes(nodes);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [nodes]);

  function runSimulationStep() {
    const latest = simulateNetwork(nodes, edges, traffic);

    setTick((current) => current + 1);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.scaleMode !== "auto") {
          return node;
        }

        const metrics = latest.nodeMetrics[node.id];
        if (!metrics) {
          return node;
        }

        if (metrics.overloadRatio > 1.12 && node.instances < 6) {
          return { ...node, instances: node.instances + 1 };
        }

        if (metrics.overloadRatio < 0.42 && node.instances > 1) {
          return { ...node, instances: node.instances - 1 };
        }

        return node;
      }),
    );
  }

  const advanceSimulation = useEffectEvent(() => {
    runSimulationStep();
  });

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(
      () => advanceSimulation(),
      Math.max(260, 960 / traffic.speed),
    );

    return () => window.clearInterval(interval);
  }, [isRunning, traffic.speed]);

  const dragMove = useEffectEvent((event: PointerEvent) => {
    if (!dragging || !canvasRef.current) {
      return;
    }

    const dragStart = dragPointerStartRef.current;
    if (dragStart) {
      const movedX = event.clientX - dragStart.x;
      const movedY = event.clientY - dragStart.y;
      if (Math.hypot(movedX, movedY) > NODE_DRAG_CLICK_THRESHOLD) {
        suppressNodeClickRef.current = true;
      }
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoomRef.current - dragging.offsetX;
    const y = (event.clientY - rect.top) / zoomRef.current - dragging.offsetY;

    setNodes((current) =>
      current.map((node) =>
        node.id === dragging.id
          ? {
              ...node,
              x: clamp(x, 0, CANVAS_WIDTH - NODE_WIDTH),
              y: clamp(y, 0, CANVAS_HEIGHT - NODE_HEIGHT),
            }
          : node,
      ),
    );
  });

  const connectionMove = useEffectEvent((event: PointerEvent) => {
    if (!connecting) {
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    setConnecting((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y,
          }
        : current,
    );
  });

  const panMove = useEffectEvent((event: PointerEvent) => {
    if (!panning || !viewportRef.current) {
      return;
    }

    viewportRef.current.scrollLeft = panning.scrollLeft - (event.clientX - panning.startX);
    viewportRef.current.scrollTop = panning.scrollTop - (event.clientY - panning.startY);
  });

  const stopDragging = useEffectEvent(() => {
    dragPointerStartRef.current = null;
    setDragging(null);
  });

  const stopConnecting = useEffectEvent(() => {
    setConnecting(null);
  });

  const stopPanning = useEffectEvent(() => {
    setPanning(null);
  });

  useEffect(() => {
    if (!dragging) {
      return;
    }

    window.addEventListener("pointermove", dragMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", dragMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [dragging]);

  useEffect(() => {
    if (!panning) {
      return;
    }

    window.addEventListener("pointermove", panMove);
    window.addEventListener("pointerup", stopPanning);

    return () => {
      window.removeEventListener("pointermove", panMove);
      window.removeEventListener("pointerup", stopPanning);
    };
  }, [panning]);

  useEffect(() => {
    if (!connecting) {
      return;
    }

    window.addEventListener("pointermove", connectionMove);
    window.addEventListener("pointerup", stopConnecting);

    return () => {
      window.removeEventListener("pointermove", connectionMove);
      window.removeEventListener("pointerup", stopConnecting);
    };
  }, [connecting]);

  const dismissFloatingPanels = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node;
    const insideWorkspaceMenu = workspaceMenuRef.current?.contains(target);
    const insideScenarioMenu = scenarioMenuRef.current?.contains(target);
    const insideInspector = nodeInspectorRef.current?.contains(target);

    if (!insideWorkspaceMenu) {
      setIsWorkspaceMenuOpen(false);
    }

    if (!insideScenarioMenu) {
      setIsScenarioMenuOpen(false);
    }

    if (!insideInspector && !dragging) {
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setConnecting(null);
    }
  });

  useEffect(() => {
    window.addEventListener("pointerdown", dismissFloatingPanels);
    return () => window.removeEventListener("pointerdown", dismissFloatingPanels);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setIsWorkspaceMenuOpen(false);
        setSelectedNodeId("");
        setSelectedEdgeId("");
        setConnecting(null);
      }

      if (event.key === "Delete" && selectedEdgeId && !isEditable) {
        event.preventDefault();
        deleteEdge(selectedEdgeId);
      }

      if (event.key === "Delete" && selectedNodeId && !isEditable) {
        event.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteEdge, selectedEdgeId, selectedNodeId]);

  function stepSimulation() {
    runSimulationStep();
  }

  function selectNode(targetNodeId: string) {
    setSelectedNodeId(targetNodeId);
    setSelectedEdgeId("");
  }

  function patchSelectedNode(patch: Partial<ArchitectureNode>) {
    if (!selectedNode) {
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node,
      ),
    );
  }

  function patchSelectedNodeEndpoint(
    index: number,
    patch: { method?: RequestMethod; path?: string },
  ) {
    if (!selectedNode) {
      return;
    }

    const endpoints = [...selectedNode.endpoints];
    const parsed = parseEndpoint(endpoints[index] ?? "GET /");
    const nextMethod = patch.method ?? parsed.method;
    const nextPath = patch.path ?? parsed.path;
    endpoints[index] = formatEndpoint(nextMethod, nextPath);
    patchSelectedNode({ endpoints });
  }

  function addClientEndpoint() {
    if (!selectedNode) {
      return;
    }

    patchSelectedNode({
      endpoints: [...selectedNode.endpoints, "GET /new-route"],
    });
  }

  function removeSelectedNodeEndpoint(index: number) {
    if (!selectedNode) {
      return;
    }

    const nextEndpoints = selectedNode.endpoints.filter((_, itemIndex) => itemIndex !== index);
    patchSelectedNode({
      endpoints: nextEndpoints.length > 0 ? nextEndpoints : ["GET /"],
    });
  }

  function addComponent(kind: ArchitectureNode["kind"]) {
    setNodes((current) => {
      const index = current.filter((node) => node.kind === kind).length + 1;
      const nextNode = buildNodeFromPalette(kind, index);
      setSelectedNodeId(nextNode.id);
      setSelectedEdgeId("");
      return [...current, nextNode];
    });
  }

  function saveCurrentDesign() {
    const name = `Architecture v${savedDesigns.length + 1}`;
    const entry: SavedDesign = {
      id: `${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      nodes,
      edges,
      traffic,
    };

    setSavedDesigns((current) => [entry, ...current].slice(0, 6));
    setIsWorkspaceMenuOpen(false);
  }

  function loadDesign(design: SavedDesign) {
    const nextNodes = centerNodesOnCanvas(design.nodes);
    startTransition(() => {
      setNodes(nextNodes);
      setEdges(design.edges);
      setTraffic(design.traffic);
      setTick(0);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setConnecting(null);
      setIsWorkspaceMenuOpen(false);
      window.requestAnimationFrame(() => centerViewportOnNodes(nextNodes));
    });
  }

  function runScenario(scenarioId: string) {
    const next = applyScenario(scenarioId, nodes, traffic);
    const nextNodes = centerNodesOnCanvas(next.nodes);
    startTransition(() => {
      setActiveScenarioId(scenarioId);
      setNodes(nextNodes);
      setTraffic(next.traffic);
      setTick(0);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setConnecting(null);
      setIsScenarioMenuOpen(false);
      window.requestAnimationFrame(() => centerViewportOnNodes(nextNodes));
    });
  }

  function restoreStarterWorkspace() {
    const nextNodes = centerNodesOnCanvas(activeArchitecture.nodes.map((node) => ({ ...node })));
    startTransition(() => {
      setNodes(nextNodes);
      setEdges(activeArchitecture.edges);
      setTraffic(activeArchitecture.traffic);
      setActiveScenarioId("");
      setTick(0);
      setConnecting(null);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setIsWorkspaceMenuOpen(false);
      window.requestAnimationFrame(() => centerViewportOnNodes(nextNodes));
    });
  }

  function switchArchitecture(architectureId: string) {
    const preset = getArchitecturePreset(architectureId);
    const nextNodes = centerNodesOnCanvas(preset.nodes.map((node) => ({ ...node })));
    startTransition(() => {
      setActiveArchitectureId(preset.id);
      setNodes(nextNodes);
      setEdges(preset.edges);
      setTraffic(preset.traffic);
      setActiveScenarioId("");
      setTick(0);
      setConnecting(null);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setIsWorkspaceMenuOpen(false);
      setIsScenarioMenuOpen(false);
      window.requestAnimationFrame(() => centerViewportOnNodes(nextNodes));
    });
  }

  function clearCanvas() {
    startTransition(() => {
      setNodes([]);
      setEdges([]);
      setTick(0);
      setConnecting(null);
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setIsWorkspaceMenuOpen(false);
    });
  }

  const serverNodeCount = nodes.filter((node) => node.kind !== "client").length;
  const healthyCount = Object.entries(snapshot.nodeMetrics).filter(
    ([nodeId, metric]) => nodes.find((node) => node.id === nodeId)?.kind !== "client" && metric.status === "healthy",
  ).length;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_22%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef4fb_100%)] text-slate-900">
      <div className="mx-auto max-w-[1920px]">
        <section style={{height: "100vh"}} className="canvas-surface relative overflow-hidden border border-slate-200/80 bg-white/88 shadow-[0_30px_80px_rgba(148,163,184,0.24)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_0)] bg-[length:16px_16px]" />

          <aside
            className={`absolute left-5 top-5 z-20 overflow-hidden rounded-[28px] border border-slate-200 bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur transition-all ${
              isPaletteCollapsed ? "w-[74px]" : "w-[224px]"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <div className={isPaletteCollapsed ? "hidden" : "block"}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Components
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaletteCollapsed((current) => !current)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                aria-label={isPaletteCollapsed ? "Expand components panel" : "Collapse components panel"}
              >
                {isPaletteCollapsed ? "+" : "-"}
              </button>
            </div>

            <div className="space-y-1 px-2 pb-3">
              {COMPONENT_LIBRARY.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => addComponent(item.kind)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] font-semibold text-slate-700">
                    {kindAppearance[item.kind].icon}
                  </div>
                  <div className={isPaletteCollapsed ? "hidden" : "block"}>
                    <div className="text-sm font-medium text-slate-800">{item.label}</div>
                  </div>
                </button>
              ))}
            </div>

            {!isPaletteCollapsed ? (
              <div className="border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  Clear Canvas
                </button>
              </div>
            ) : null}
          </aside>

          <div className="absolute left-1/2 top-5 z-20 flex -translate-x-1/2 gap-3">
            <div className="relative" ref={workspaceMenuRef}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsScenarioMenuOpen(false);
                  setIsWorkspaceMenuOpen((current) => !current);
                }}
                className="flex items-center gap-3 rounded-[18px] border border-emerald-500 bg-white px-6 py-3 text-lg font-semibold text-slate-800 shadow-[0_12px_24px_rgba(34,197,94,0.16)] transition hover:-translate-y-0.5"
              >
                <span>{activeArchitecture.name}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className={`h-4 w-4 text-emerald-600 transition ${isWorkspaceMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                >
                  <path
                    d="M3.5 6 8 10.5 12.5 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isWorkspaceMenuOpen ? (
                <div
                  className="absolute left-1/2 top-[calc(100%+14px)] w-[360px] -translate-x-1/2 rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRunning((current) => !current)}
                      className={panelButtonClass(isRunning)}
                    >
                      {isRunning ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stepSimulation();
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className={panelButtonClass()}
                    >
                      Step
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNodes((current) => {
                          const nextNodes = centerNodesOnCanvas(autoLayout(current));
                          window.requestAnimationFrame(() => centerViewportOnNodes(nextNodes));
                          return nextNodes;
                        });
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className={panelButtonClass()}
                    >
                      Auto-layout
                    </button>
                    <button
                      type="button"
                      onClick={saveCurrentDesign}
                      className={panelButtonClass()}
                    >
                      Save
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Simulation speed
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.5"
                      value={traffic.speed}
                      onChange={(event) =>
                        setTraffic((current) => ({
                          ...current,
                          speed: Number(event.target.value),
                        }))
                      }
                      className="mt-3 w-full"
                    />
                    <div className="mt-1 text-sm text-slate-500">{traffic.speed.toFixed(1)}x realtime</div>
                  </div>

                  <div className="mt-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Platform architectures
                    </div>
                    <div className="mt-3 grid gap-2">
                      {ARCHITECTURE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => switchArchitecture(preset.id)}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            activeArchitectureId === preset.id
                              ? "border-emerald-300 bg-emerald-50 text-slate-900"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="text-sm font-semibold">{preset.name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Saved views
                      </div>
                      <button
                        type="button"
                        onClick={restoreStarterWorkspace}
                        className="text-xs font-medium text-rose-500 transition hover:text-rose-600"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {savedDesigns.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                          Save a state to replay it later.
                        </div>
                      ) : (
                        savedDesigns.map((design) => (
                          <button
                            key={design.id}
                            type="button"
                            onClick={() => loadDesign(design)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                          >
                            <div className="text-sm font-semibold text-slate-800">{design.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {new Date(design.savedAt).toLocaleString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative" ref={scenarioMenuRef}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsWorkspaceMenuOpen(false);
                  setIsScenarioMenuOpen((current) => !current);
                }}
                className="flex items-center gap-3 rounded-[18px] border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-800 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5"
              >
                <span>Scenarios</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className={`h-4 w-4 text-slate-500 transition ${isScenarioMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                >
                  <path
                    d="M3.5 6 8 10.5 12.5 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isScenarioMenuOpen ? (
                <div
                  className="absolute left-1/2 top-[calc(100%+14px)] w-[360px] -translate-x-1/2 rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Scenarios
                  </div>
                  <div className="mt-3 grid gap-2">
                    {SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => runScenario(scenario.id)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          activeScenarioId === scenario.id
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-sm font-semibold">{scenario.name}</div>
                        <div
                          className={`mt-1 text-xs leading-5 ${
                            activeScenarioId === scenario.id ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {scenario.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* <aside className="absolute right-5 top-5 z-20 w-[264px] rounded-[28px] border border-slate-200 bg-white/92 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                Metrics
              </div>
              <button
                type="button"
                onClick={() => setIsMetricsExpanded((current) => !current)}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              >
                {isMetricsExpanded ? "Hide" : "Show"}
              </button>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Availability
              </div>
              <div className={`mt-1 text-[2rem] font-semibold ${metricValueClasses(snapshot.system.availability > 0.985 ? "healthy" : snapshot.system.availability > 0.95 ? "degraded" : "failing")}`}>
                {percent(snapshot.system.availability)}
              </div>
            </div>

            {isMetricsExpanded ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Avg Latency
                  </div>
                  <div className="mt-1 text-lg font-semibold text-blue-600">
                    {snapshot.system.latency.toFixed(1)} ms
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Throughput
                  </div>
                  <div className="mt-1 text-lg font-semibold text-orange-500">
                    {formatCompact(snapshot.system.throughput)} rps
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Healthy
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">
                    {healthyCount}/{serverNodeCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Tick
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">{tick}</div>
                </div>
              </div>
            ) : null}
          </aside> */}

          {connecting ? (
            <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
              Drag to another side connector to create a link
            </div>
          ) : selectedEdge && selectedEdgeSource && selectedEdgeTarget ? (
            <div className="absolute bottom-5 right-5 z-30 w-[min(460px,calc(100%-2rem))]" ref={nodeInspectorRef}>
              <div
                className="max-h-[calc(100vh-11rem)] overflow-auto rounded-[30px] border border-slate-200 bg-white/96 p-5 shadow-[0_28px_60px_rgba(15,23,42,0.16)] backdrop-blur"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Selected connection
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {selectedEdgeSource.label} to {selectedEdgeTarget.label}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">
                      {selectedEdge.protocol === "async"
                        ? "Asynchronous message flow between components."
                        : "Synchronous request path between components."}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => deleteEdge(selectedEdge.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      Delete connection
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEdgeId("")}
                      className={panelButtonClass()}
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Source
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedEdgeSource.label}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Target
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedEdgeTarget.label}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Protocol
                    </div>
                    <div className="mt-1 text-sm font-semibold uppercase text-slate-900">
                      {selectedEdge.protocol}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Throughput
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCompact(selectedEdgeMetrics?.rps ?? 0)} rps
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Returns
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCompact(selectedEdgeMetrics?.returnRps ?? 0)} rps
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2 rounded-[20px] border border-slate-200/90 bg-white/95 px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <button
              type="button"
              onClick={() => adjustZoom(zoom / ZOOM_STEP)}
              className={panelButtonClass()}
              aria-label="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => fitViewportToNodes(nodes)}
              className={panelButtonClass()}
            >
              Fit System
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(zoom * ZOOM_STEP)}
              className={panelButtonClass()}
              aria-label="Zoom in"
            >
              +
            </button>
            <div className="min-w-14 text-right font-mono text-xs font-semibold text-slate-500">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          <div
            style={{ height: "100%" }}
            ref={viewportRef}
            className={`absolute inset-0 z-10 overflow-auto ${
              panning ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div
              ref={canvasRef}
              className="relative rounded-[32px]"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom,
              }}
              onPointerDown={(event) => {
                if (
                  (event.target === event.currentTarget || event.target instanceof SVGSVGElement) &&
                  viewportRef.current
                ) {
                  setSelectedNodeId("");
                  setSelectedEdgeId("");
                  setConnecting(null);
                  setPanning({
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    scrollLeft: viewportRef.current.scrollLeft,
                    scrollTop: viewportRef.current.scrollTop,
                  });
                }
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                  transform: `scale(${zoom})`,
                }}
              >
                <svg
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="absolute inset-0"
                  viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                  fill="none"
                >
                  {edges.map((edge) => {
                    const source = nodes.find((node) => node.id === edge.source);
                    const target = nodes.find((node) => node.id === edge.target);
                    if (!source || !target) {
                      return null;
                    }

                    const sourceSide = edge.sourceSide ?? "right";
                    const targetSide = edge.targetSide ?? "left";
                    const sourcePoint = getConnectionPoint(source, sourceSide);
                    const targetPoint = getConnectionPoint(target, targetSide);
                    const x1 = sourcePoint.x;
                    const y1 = sourcePoint.y;
                    const x2 = targetPoint.x;
                    const y2 = targetPoint.y;
                    const path = buildConnectionPath(x1, y1, sourceSide, x2, y2, targetSide);
                    const metric = snapshot.edgeMetrics[edge.id];
                    const sourceRoutes = snapshot.nodeRoutes[source.id] ?? [];
                    const returnRoutes = snapshot.edgeReturnRoutes[edge.id] ?? [];
                    const forwardAnimatedPaths =
                      source.kind === "client"
                        ? sourceRoutes.slice(0, 2).map((route, index) => {
                            const routeY =
                              source.y + ROUTE_ROW_CENTER_OFFSET + index * ROUTE_ROW_GAP;
                            return {
                              key: `${edge.id}-${route.key}-forward`,
                              path: `M ${x1} ${routeY} C ${x1 + 48} ${routeY}, ${x2 - 90} ${y2}, ${x2} ${y2}`,
                              color:
                                route.method === "POST" ||
                                route.method === "PUT" ||
                                route.method === "PATCH"
                                  ? "#f97316"
                                  : route.method === "DELETE"
                                    ? "#ef4444"
                                    : "#2563eb",
                              rps: route.rps,
                            };
                          })
                        : [
                            {
                              key: `${edge.id}-forward`,
                              path,
                              color: edge.protocol === "async" ? "#f97316" : "#22c55e",
                              rps: metric?.rps ?? 0,
                            },
                          ];
                    const returnAnimatedPaths =
                      source.kind === "client"
                        ? returnRoutes.slice(0, 2).map((route, index) => {
                            const routeY =
                              source.y + ROUTE_ROW_CENTER_OFFSET + index * ROUTE_ROW_GAP;
                            return {
                              key: `${edge.id}-${route.key}-return`,
                              path: buildReverseClientRoutePath(x1, routeY, x2, y2),
                              color: edge.protocol === "async" ? "#f59e0b" : "#14b8a6",
                              rps: route.rps,
                            };
                          })
                        : [
                            {
                              key: `${edge.id}-return`,
                              path: buildConnectionPath(x2, y2, targetSide, x1, y1, sourceSide),
                              color: edge.protocol === "async" ? "#f59e0b" : "#14b8a6",
                              rps: metric?.returnRps ?? 0,
                            },
                          ];

                    return (
                      <g key={edge.id}>
                        <path
                          d={path}
                          stroke="rgba(148,163,184,0.25)"
                          strokeWidth={8}
                          strokeLinecap="round"
                          className="cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedNodeId("");
                            setSelectedEdgeId(edge.id);
                            setConnecting(null);
                          }}
                        />
                        <path
                          d={path}
                          stroke={
                            selectedEdgeId === edge.id
                              ? "#0f172a"
                              : edge.protocol === "async"
                                ? "#fb923c"
                                : "#3b82f6"
                          }
                          strokeWidth={selectedEdgeId === edge.id ? 5 : 4}
                          strokeLinecap="round"
                          strokeDasharray="0 11"
                          opacity={0.85}
                          className="pointer-events-none"
                        />
                        {forwardAnimatedPaths.map((animatedPath) => {
                          const dotCount = requestDotCount(animatedPath.rps);
                          const duration = requestDotDuration(animatedPath.rps, traffic.speed);
                          const emissionSpacing = dotCount > 0 ? duration / dotCount : duration;

                          return dotCount > 0
                            ? Array.from({ length: dotCount }, (_, index) => (
                                <circle
                                  key={`${animatedPath.key}-${index}`}
                                  r="4"
                                  fill={animatedPath.color}
                                  className="pointer-events-none"
                                >
                                  <animateMotion
                                    dur={`${duration}s`}
                                    repeatCount="indefinite"
                                    begin={`${index * emissionSpacing}s`}
                                    path={animatedPath.path}
                                  />
                                </circle>
                              ))
                            : null;
                        })}
                        {returnAnimatedPaths.map((animatedPath) => {
                          const dotCount = requestDotCount(animatedPath.rps);
                          const duration = requestDotDuration(animatedPath.rps, traffic.speed);
                          const emissionSpacing = dotCount > 0 ? duration / dotCount : duration;

                          return dotCount > 0
                            ? Array.from({ length: dotCount }, (_, index) => (
                                <circle
                                  key={`${animatedPath.key}-${index}`}
                                  r="3"
                                  fill={animatedPath.color}
                                  opacity={0.85}
                                  className="pointer-events-none"
                                >
                                  <animateMotion
                                    dur={`${duration}s`}
                                    repeatCount="indefinite"
                                    begin={`${index * emissionSpacing}s`}
                                    path={animatedPath.path}
                                  />
                                </circle>
                              ))
                            : null;
                        })}
                      </g>
                    );
                  })}
                  {connecting ? (
                    (() => {
                      const sourceNode = nodes.find((node) => node.id === connecting.sourceNodeId);
                      if (!sourceNode) {
                        return null;
                      }

                      const sourcePoint = getConnectionPoint(sourceNode, connecting.sourceSide);
                      const previewPath = buildConnectionPath(
                        sourcePoint.x,
                        sourcePoint.y,
                        connecting.sourceSide,
                        connecting.currentX,
                        connecting.currentY,
                        connecting.sourceSide === "left" ? "right" : "left",
                      );

                      return (
                        <g>
                          <path
                            d={previewPath}
                            stroke="rgba(59,130,246,0.2)"
                            strokeWidth={8}
                            strokeLinecap="round"
                            className="pointer-events-none"
                          />
                          <path
                            d={previewPath}
                            stroke="#2563eb"
                            strokeWidth={4}
                            strokeLinecap="round"
                            strokeDasharray="10 10"
                            opacity={0.9}
                            className="pointer-events-none"
                          />
                        </g>
                      );
                    })()
                  ) : null}
                </svg>

                {nodes.map((node) => {
                  const appearance = kindAppearance[node.kind];
                  const metrics = snapshot.nodeMetrics[node.id];
                  const selected = selectedNodeId === node.id;
                  const routes = snapshot.nodeRoutes[node.id] ?? [];
                  const visibleRoutes = routes.slice(0, 2);
                  const connectionSides: ConnectionSide[] = ["left", "right"];

                  return (
                    <div
                      key={node.id}
                      className="absolute"
                      style={{
                        left: node.x,
                        top: node.y,
                        width: NODE_WIDTH,
                        height: NODE_HEIGHT,
                      }}
                    >
                      {connectionSides.map((side) => {
                        const isActiveHandle =
                          connecting?.sourceNodeId === node.id && connecting.sourceSide === side;

                        return (
                          <button
                            key={`${node.id}-${side}`}
                            type="button"
                            aria-label={`Connect from ${node.label} ${side} side`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              const point = getCanvasPointFromClient(event.clientX, event.clientY);
                              if (!point) {
                                return;
                              }

                              setSelectedNodeId(node.id);
                              setSelectedEdgeId("");
                              setConnecting({
                                sourceNodeId: node.id,
                                sourceSide: side,
                                currentX: point.x,
                                currentY: point.y,
                              });
                            }}
                            onPointerUp={(event) => {
                              event.stopPropagation();
                              if (!connecting) {
                                return;
                              }

                              createEdge(
                                connecting.sourceNodeId,
                                connecting.sourceSide,
                                node.id,
                                side,
                              );
                              setConnecting(null);
                              setSelectedNodeId(node.id);
                              setSelectedEdgeId("");
                            }}
                            className={`absolute top-1/2 z-20 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm transition ${
                              isActiveHandle
                                ? "border-slate-900 bg-slate-900"
                                : "border-blue-300 hover:border-blue-500"
                            }`}
                            style={{
                              width: NODE_CONNECTION_HANDLE_SIZE,
                              height: NODE_CONNECTION_HANDLE_SIZE,
                              left: side === "left" ? -NODE_CONNECTION_HANDLE_OFFSET : undefined,
                              right: side === "right" ? -NODE_CONNECTION_HANDLE_OFFSET : undefined,
                            }}
                          >
                            <span
                              className={`block h-full w-full rounded-full ${
                                isActiveHandle ? "bg-slate-900" : "bg-blue-400"
                              }`}
                            />
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (suppressNodeClickRef.current) {
                            suppressNodeClickRef.current = false;
                            return;
                          }
                          setSelectedEdgeId("");
                          selectNode(node.id);
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          suppressNodeClickRef.current = false;
                          dragPointerStartRef.current = {
                            x: event.clientX,
                            y: event.clientY,
                          };
                          const rect = event.currentTarget.getBoundingClientRect();
                          setDragging({
                            id: node.id,
                            offsetX: (event.clientX - rect.left) / zoomRef.current,
                            offsetY: (event.clientY - rect.top) / zoomRef.current,
                          });
                        }}
                        className={`h-full w-full rounded-[24px] border bg-white p-3 text-left transition ${
                          selected
                            ? "border-slate-900 shadow-[0_18px_38px_rgba(15,23,42,0.16)]"
                            : "border-slate-200 shadow-[0_10px_26px_rgba(15,23,42,0.08)] hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                              {appearance.badge}
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-800">
                              {node.label}
                            </div>
                          </div>
                          {node.kind === "client" ? null : (
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClasses(metrics?.status ?? "healthy")}`}
                            >
                              {metrics?.status ?? "healthy"}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div className="text-[11px] text-slate-500">
                            {node.instances} instance{node.instances > 1 ? "s" : ""}
                          </div>
                          {metrics ? (
                            <div className="text-right">
                              <div className="font-mono text-[10px] font-medium text-slate-700">
                                {formatCompact(metrics.emittedRps)} emit
                              </div>
                              <div className="font-mono text-[9px] text-slate-400">
                                {formatCompact(metrics.incomingRps)} current
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono text-[11px] font-medium text-slate-700">0</div>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className={`block h-full rounded-full bg-gradient-to-r ${metricBarClass(metrics?.status ?? "healthy")}`}
                            style={{
                              width: `${Math.min(metrics?.cpu ?? 0, 100)}%`,
                            }}
                          />
                        </div>

                        {visibleRoutes.length > 0 ? (
                          <div className="mt-2.5">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {routeSectionLabel(node)}
                            </div>
                            <div className="mt-1.5 space-y-1">
                              {visibleRoutes.map((route) => (
                                <div
                                  key={`${node.id}-${route.key}`}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2 py-1"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${requestMethodClass(route.method)}`}
                                    >
                                      {route.method}
                                    </span>
                                    <span className="truncate font-mono text-[10px] text-slate-600">
                                      {route.path}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-mono text-[9px] text-slate-400">
                                    {formatCompact(route.rps)} rps
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
          </div>

          {selectedNode && selectedMetrics ? (
            <div className="absolute bottom-5 right-5 z-30 w-[min(620px,calc(100%-2rem))]" ref={nodeInspectorRef}>
              <div
                className="max-h-[calc(100vh-11rem)] overflow-auto rounded-[30px] border border-slate-200 bg-white/96 p-5 shadow-[0_28px_60px_rgba(15,23,42,0.16)] backdrop-blur"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Selected component
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{selectedNode.label}</div>
                    <div className="mt-1 max-w-[560px] text-sm leading-6 text-slate-500">
                      {selectedNode.description}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId("")}
                      className={panelButtonClass()}
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      CPU
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {selectedMetrics.cpu.toFixed(0)}%
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Response
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {selectedMetrics.latency.toFixed(0)} ms
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Error Rate
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {percent(selectedMetrics.errorRate)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Availability
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {percent(selectedMetrics.availability)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-700">
                  Drag from a side connector into another node&apos;s side connector to create a connection.
                </div>

                <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {selectedNode.kind === "client" ? "Traffic streams" : "Observed routes"}
                    </div>
                    {selectedNode.kind === "client" ? (
                      <button
                        type="button"
                        onClick={addClientEndpoint}
                        className={panelButtonClass()}
                      >
                        Add stream
                      </button>
                    ) : null}
                  </div>

                  {selectedNode.kind === "client" ? (
                    <div className="mt-4 space-y-3">
                      {selectedNode.endpoints.map((endpoint, index) => {
                        const parsed = parseEndpoint(endpoint);
                        return (
                          <div
                            key={`${selectedNode.id}-endpoint-${index}`}
                            className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[96px_minmax(0,1fr)_auto]"
                          >
                            <select
                              value={parsed.method}
                              onChange={(event) =>
                                patchSelectedNodeEndpoint(index, {
                                  method: event.target.value as RequestMethod,
                                })
                              }
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="PATCH">PATCH</option>
                              <option value="DELETE">DELETE</option>
                            </select>
                            <input
                              type="text"
                              value={parsed.path}
                              onChange={(event) =>
                                patchSelectedNodeEndpoint(index, {
                                  path: event.target.value || "/",
                                })
                              }
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeSelectedNodeEndpoint(index)}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : selectedRoutes.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {selectedRoutes.map((route) => (
                        <div
                          key={`${selectedNode.id}-${route.key}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${requestMethodClass(route.method)}`}
                            >
                              {route.method}
                            </span>
                            <span className="truncate font-mono text-sm text-slate-600">
                              {route.path}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-xs text-slate-400">
                            {formatCompact(route.rps)} rps
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                      This node will list matching request types as soon as traffic reaches it.
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {selectedNode.kind === "client" ? (
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 lg:col-span-2">
                      <div className="text-sm font-semibold text-slate-800">Client load controls</div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {clientNodes.map((clientNode) => (
                          <label
                            key={clientNode.id}
                            className="block rounded-2xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-500"
                          >
                            {clientNode.label} RPS
                            <input
                              type="range"
                              min="0"
                              max="2400"
                              step="10"
                              value={clientNode.sourceRps}
                              onChange={(event) =>
                                setNodes((current) =>
                                  current.map((node) =>
                                    node.id === clientNode.id
                                      ? { ...node, sourceRps: Number(event.target.value) }
                                      : node,
                                  ),
                                )
                              }
                              className="mt-2 w-full"
                            />
                            <span className="mt-1 block text-sm text-slate-700">
                              {clientNode.sourceRps} RPS emitted
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Total ingress
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {formatCompact(
                              clientNodes.reduce(
                                (sum, node) =>
                                  sum + (snapshot.nodeMetrics[node.id]?.emittedRps ?? 0),
                                0,
                              ),
                            )} rps
                          </div>
                        </div>
                        <label className="block rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-500">
                          Base latency
                          <input
                            type="range"
                            min="8"
                            max="260"
                            step="2"
                            value={selectedNode.baseLatency}
                            onChange={(event) =>
                              patchSelectedNode({
                                baseLatency: Number(event.target.value),
                              })
                            }
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-sm text-slate-700">
                            {selectedNode.baseLatency} ms
                          </span>
                        </label>
                        <label className="block rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-500">
                          Fault injection
                          <select
                            value={selectedNode.faultMode}
                            onChange={(event) =>
                              patchSelectedNode({
                                faultMode: event.target.value as FaultMode,
                              })
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                          >
                            <option value="none">Healthy</option>
                            <option value="latency">High latency</option>
                            <option value="timeout">Timeouts</option>
                            <option value="crash">Service crash</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-sm font-semibold text-slate-800">Compute profile</div>
                        <div className="mt-4 space-y-4">
                          <label className="block text-xs font-medium text-slate-500">
                            CPU family
                            <select
                              value={selectedNode.instanceType}
                              onChange={(event) =>
                                patchSelectedNode({
                                  instanceType: event.target.value as ArchitectureNode["instanceType"],
                                })
                              }
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                            >
                              {CLOUD_INSTANCE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="mt-1 block text-sm text-slate-700">
                              {selectedCloudProfile?.cpuLabel}
                            </span>
                          </label>

                          <label className="block text-xs font-medium text-slate-500">
                            Memory size
                            <input
                              type="range"
                              min="4"
                              max="32"
                              step="4"
                              value={selectedNode.memoryGb}
                              onChange={(event) =>
                                patchSelectedNode({
                                  memoryGb: Number(event.target.value),
                                })
                              }
                              className="mt-2 w-full"
                            />
                            <span className="mt-1 block text-sm text-slate-700">
                              {selectedNode.memoryGb} GB RAM
                            </span>
                          </label>

                          <label className="block text-xs font-medium text-slate-500">
                            Base latency
                            <input
                              type="range"
                              min="8"
                              max="260"
                              step="2"
                              value={selectedNode.baseLatency}
                              onChange={(event) =>
                                patchSelectedNode({
                                  baseLatency: Number(event.target.value),
                                })
                              }
                              className="mt-2 w-full"
                            />
                            <span className="mt-1 block text-sm text-slate-700">
                              {selectedNode.baseLatency} ms
                            </span>
                          </label>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Limit
                              </div>
                              <div className="mt-1 text-lg font-semibold text-slate-900">
                                {formatCompact(selectedMetrics.processingCapacity)} rps
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Current
                              </div>
                              <div className="mt-1 text-lg font-semibold text-slate-900">
                                {formatCompact(selectedMetrics.incomingRps)} rps
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Throughput
                              </div>
                              <div className="mt-1 text-lg font-semibold text-slate-900">
                                {formatCompact(selectedMetrics.throughput)} rps
                              </div>
                            </div>
                            <label className="block text-xs font-medium text-slate-500">
                              Instances
                              <input
                                type="number"
                                min="1"
                                max="8"
                                value={selectedNode.instances}
                                onChange={(event) =>
                                  patchSelectedNode({
                                    instances: clamp(Number(event.target.value), 1, 8),
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                              />
                            </label>

                            <label className="block text-xs font-medium text-slate-500">
                              Scaling
                              <select
                                value={selectedNode.scaleMode}
                                onChange={(event) =>
                                  patchSelectedNode({
                                    scaleMode: event.target.value as ScaleMode,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                              >
                                <option value="manual">Manual</option>
                                <option value="auto">Auto-scale</option>
                              </select>
                            </label>
                          </div>

                          <label className="block text-xs font-medium text-slate-500">
                            Fault injection
                            <select
                              value={selectedNode.faultMode}
                              onChange={(event) =>
                                patchSelectedNode({
                                  faultMode: event.target.value as FaultMode,
                                })
                              }
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                            >
                              <option value="none">Healthy</option>
                              <option value="latency">High latency</option>
                              <option value="timeout">Timeouts</option>
                              <option value="crash">Service crash</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-sm font-semibold text-slate-800">Routing summary</div>
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Incoming load
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {formatCompact(selectedMetrics.incomingRps)} rps
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Throughput
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {formatCompact(selectedMetrics.throughput)} rps
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Limit
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {formatCompact(selectedMetrics.processingCapacity)} rps
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Active routes
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {selectedRoutes.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
