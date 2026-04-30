export type NodeKind =
  | "client"
  | "gateway"
  | "load-balancer"
  | "service"
  | "database"
  | "cache"
  | "queue";

export type FaultMode = "none" | "latency" | "timeout" | "crash";
export type ScaleMode = "manual" | "auto";
export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "EVENT";
export type CloudInstanceType = "t3-medium" | "c6i-large" | "m7i-large" | "r6i-large";
export type ConnectionSide = "left" | "right";

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: NodeKind;
  x: number;
  y: number;
  domain: string;
  description: string;
  endpoints: string[];
  sourceRps: number;
  instanceType: CloudInstanceType;
  memoryGb: number;
  baseLatency: number;
  baseErrorRate: number;
  instances: number;
  scaleMode: ScaleMode;
  faultMode: FaultMode;
  weight: number;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
  label: string;
  protocol: "sync" | "async";
  trafficShare: number;
}

export interface TrafficProfile {
  speed: number;
  failureBias: number;
}

export interface NodeMetrics {
  id: string;
  incomingRps: number;
  throughput: number;
  emittedRps: number;
  processingCapacity: number;
  availability: number;
  latency: number;
  cpu: number;
  errorRate: number;
  overloadRatio: number;
  queueDepth: number;
  cacheHitRate: number;
  status: "healthy" | "degraded" | "failing";
  suggestedInstances: number;
}

export interface EdgeMetrics {
  id: string;
  rps: number;
  returnRps: number;
  errorRate: number;
  latency: number;
}

export interface RouteFlow {
  key: string;
  method: RequestMethod;
  path: string;
  rps: number;
}

export interface SystemMetrics {
  availability: number;
  latency: number;
  throughput: number;
  stressedComponents: number;
  queueDepth: number;
  cacheHitRate: number;
}

export interface SimulationSnapshot {
  nodeMetrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, EdgeMetrics>;
  nodeRoutes: Record<string, RouteFlow[]>;
  edgeReturnRoutes: Record<string, RouteFlow[]>;
  system: SystemMetrics;
  hotSpots: Array<{
    id: string;
    label: string;
  }>;
}

export interface TimelineEvent {
  id: string;
  tick: number;
  headline: string;
  detail: string;
  severity: "info" | "warn" | "critical";
}

export interface SavedDesign {
  id: string;
  name: string;
  savedAt: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  traffic: TrafficProfile;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
}

export interface ArchitecturePreset {
  id: string;
  name: string;
  description: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  traffic: TrafficProfile;
}

export const CLOUD_INSTANCE_OPTIONS: Array<{
  id: CloudInstanceType;
  label: string;
  cpuLabel: string;
  memoryGb: number;
  baselineRps: number;
}> = [
  {
    id: "t3-medium",
    label: "AWS t3.medium",
    cpuLabel: "Burstable general-purpose",
    memoryGb: 4,
    baselineRps: 180,
  },
  {
    id: "c6i-large",
    label: "AWS c6i.large",
    cpuLabel: "Compute optimized",
    memoryGb: 4,
    baselineRps: 320,
  },
  {
    id: "m7i-large",
    label: "AWS m7i.large",
    cpuLabel: "Balanced general-purpose",
    memoryGb: 8,
    baselineRps: 260,
  },
  {
    id: "r6i-large",
    label: "AWS r6i.large",
    cpuLabel: "Memory optimized",
    memoryGb: 16,
    baselineRps: 240,
  },
];

export const COMPONENT_LIBRARY: Array<{
  kind: NodeKind;
  label: string;
  description: string;
  defaults: Partial<ArchitectureNode>;
}> = [
  {
    kind: "client",
    label: "Traffic Client",
    description: "Web or mobile caller that seeds external load.",
    defaults: { instanceType: "m7i-large", memoryGb: 8, baseLatency: 12, weight: 1 },
  },
  {
    kind: "gateway",
    label: "API Gateway",
    description: "Central entry point with route mapping and auth checks.",
    defaults: { instanceType: "c6i-large", memoryGb: 4, baseLatency: 24, weight: 1.1 },
  },
  {
    kind: "load-balancer",
    label: "Load Balancer",
    description: "Distributes traffic across service instances.",
    defaults: { instanceType: "c6i-large", memoryGb: 4, baseLatency: 10, weight: 0.9 },
  },
  {
    kind: "service",
    label: "Microservice",
    description: "Business domain worker with scaling and dependency rules.",
    defaults: { instanceType: "m7i-large", memoryGb: 8, baseLatency: 70, weight: 1.3 },
  },
  {
    kind: "database",
    label: "Database",
    description: "Stateful storage tier handling reads and writes.",
    defaults: { instanceType: "r6i-large", memoryGb: 16, baseLatency: 95, weight: 1.55 },
  },
  {
    kind: "cache",
    label: "Redis Cache",
    description: "Fast read layer that reduces downstream database pressure.",
    defaults: { instanceType: "r6i-large", memoryGb: 16, baseLatency: 18, weight: 0.8 },
  },
  {
    kind: "queue",
    label: "Message Queue",
    description: "Async buffer for burst absorption and worker decoupling.",
    defaults: { instanceType: "m7i-large", memoryGb: 8, baseLatency: 26, weight: 1.05 },
  },
];

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "surge",
    name: "Checkout Surge",
    description: "Black-Friday style traffic spike with elevated mobile demand.",
  },
  {
    id: "payment-failure",
    name: "Payment Failure",
    description: "Payment service crashes and queue depth starts climbing.",
  },
  {
    id: "database-slowdown",
    name: "Database Slowdown",
    description: "Order storage slows down and latency ripples upstream.",
  },
  {
    id: "cache-hot",
    name: "Cache Warmup",
    description: "Hit rate improves and database pressure drops sharply.",
  },
];

export const initialTraffic: TrafficProfile = {
  speed: 1,
  failureBias: 0.04,
};

export const initialNodes: ArchitectureNode[] = [
  {
    id: "client-web",
    label: "Web Client",
    kind: "client",
    x: 32,
    y: 96,
    domain: "Ingress",
    description: "Browser traffic for catalog and checkout journeys.",
    endpoints: ["GET /products", "POST /cart"],
    sourceRps: 4,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 10,
    baseErrorRate: 0.01,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1,
  },
  {
    id: "client-mobile",
    label: "Mobile Client",
    kind: "client",
    x: 32,
    y: 268,
    domain: "Ingress",
    description: "Mobile app sessions with spikier burst patterns.",
    endpoints: ["GET /products", "POST /orders"],
    sourceRps: 9,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 14,
    baseErrorRate: 0.012,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.05,
  },
  {
    id: "gateway",
    label: "API Gateway",
    kind: "gateway",
    x: 254,
    y: 180,
    domain: "Routing",
    description: "Authenticates, rate-limits, and dispatches external requests.",
    endpoints: ["/products", "/cart", "/orders", "/payments"],
    sourceRps: 0,
    instanceType: "c6i-large",
    memoryGb: 4,
    baseLatency: 22,
    baseErrorRate: 0.015,
    instances: 2,
    scaleMode: "auto",
    faultMode: "none",
    weight: 1.1,
  },
  {
    id: "product-lb",
    label: "Product LB",
    kind: "load-balancer",
    x: 492,
    y: 56,
    domain: "Catalog",
    description: "Balances catalog reads across product service replicas.",
    endpoints: ["GET /products"],
    sourceRps: 0,
    instanceType: "c6i-large",
    memoryGb: 4,
    baseLatency: 12,
    baseErrorRate: 0.01,
    instances: 2,
    scaleMode: "manual",
    faultMode: "none",
    weight: 0.9,
  },
  {
    id: "cart-lb",
    label: "Cart LB",
    kind: "load-balancer",
    x: 492,
    y: 250,
    domain: "Cart",
    description: "Spreads cart mutations across service shards.",
    endpoints: ["POST /cart"],
    sourceRps: 0,
    instanceType: "c6i-large",
    memoryGb: 4,
    baseLatency: 14,
    baseErrorRate: 0.012,
    instances: 2,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1,
  },
  {
    id: "order-queue",
    label: "Order Queue",
    kind: "queue",
    x: 760,
    y: 260,
    domain: "Orders",
    description: "Absorbs bursts before order orchestration and payment.",
    endpoints: ["OrderCreated"],
    sourceRps: 0,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 30,
    baseErrorRate: 0.01,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.02,
  },
  {
    id: "product-service",
    label: "Product Service",
    kind: "service",
    x: 760,
    y: 48,
    domain: "Catalog",
    description: "Serves product queries and cache hydration.",
    endpoints: ["GET /products"],
    sourceRps: 0,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 74,
    baseErrorRate: 0.02,
    instances: 3,
    scaleMode: "auto",
    faultMode: "none",
    weight: 1.2,
  },
  {
    id: "cart-service",
    label: "Cart Service",
    kind: "service",
    x: 760,
    y: 154,
    domain: "Cart",
    description: "Persists cart state and composes promotions.",
    endpoints: ["POST /cart", "PATCH /cart"],
    sourceRps: 0,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 82,
    baseErrorRate: 0.025,
    instances: 2,
    scaleMode: "auto",
    faultMode: "none",
    weight: 1.34,
  },
  {
    id: "order-service",
    label: "Order Service",
    kind: "service",
    x: 1018,
    y: 252,
    domain: "Orders",
    description: "Consumes order events and coordinates payment workflows.",
    endpoints: ["POST /orders"],
    sourceRps: 0,
    instanceType: "m7i-large",
    memoryGb: 8,
    baseLatency: 96,
    baseErrorRate: 0.03,
    instances: 2,
    scaleMode: "auto",
    faultMode: "none",
    weight: 1.44,
  },
  {
    id: "payment-service",
    label: "Payment Service",
    kind: "service",
    x: 1260,
    y: 252,
    domain: "Payments",
    description: "Processes payment authorizations and downstream provider calls.",
    endpoints: ["POST /payments"],
    sourceRps: 0,
    instanceType: "c6i-large",
    memoryGb: 4,
    baseLatency: 112,
    baseErrorRate: 0.038,
    instances: 2,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.52,
  },
  {
    id: "product-cache",
    label: "Redis Cache",
    kind: "cache",
    x: 1018,
    y: 58,
    domain: "Catalog",
    description: "Caches hot catalog reads to protect the product database.",
    endpoints: ["product:*"],
    sourceRps: 0,
    instanceType: "r6i-large",
    memoryGb: 16,
    baseLatency: 20,
    baseErrorRate: 0.008,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 0.82,
  },
  {
    id: "product-db",
    label: "Product DB",
    kind: "database",
    x: 1260,
    y: 40,
    domain: "Catalog",
    description: "Primary data store for products and inventory snapshots.",
    endpoints: ["products.read", "inventory.read"],
    sourceRps: 0,
    instanceType: "r6i-large",
    memoryGb: 16,
    baseLatency: 116,
    baseErrorRate: 0.02,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.62,
  },
  {
    id: "cart-db",
    label: "Cart DB",
    kind: "database",
    x: 1018,
    y: 146,
    domain: "Cart",
    description: "Stores cart mutations and cart recovery checkpoints.",
    endpoints: ["cart.write"],
    sourceRps: 0,
    instanceType: "r6i-large",
    memoryGb: 16,
    baseLatency: 118,
    baseErrorRate: 0.024,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.56,
  },
  {
    id: "order-db",
    label: "Orders DB",
    kind: "database",
    x: 1500,
    y: 252,
    domain: "Orders",
    description: "Stores order records, payment status, and fulfilment state.",
    endpoints: ["orders.write", "payments.write"],
    sourceRps: 0,
    instanceType: "r6i-large",
    memoryGb: 16,
    baseLatency: 130,
    baseErrorRate: 0.03,
    instances: 1,
    scaleMode: "manual",
    faultMode: "none",
    weight: 1.68,
  },
];

export const initialEdges: ArchitectureEdge[] = [
  {
    id: "edge-web-gateway",
    source: "client-web",
    target: "gateway",
    label: "HTTPS",
    protocol: "sync",
    trafficShare: 1,
  },
  {
    id: "edge-mobile-gateway",
    source: "client-mobile",
    target: "gateway",
    label: "HTTPS",
    protocol: "sync",
    trafficShare: 1,
  },
  {
    id: "edge-gateway-product",
    source: "gateway",
    target: "product-lb",
    label: "/products",
    protocol: "sync",
    trafficShare: 0.42,
  },
  {
    id: "edge-gateway-cart",
    source: "gateway",
    target: "cart-lb",
    label: "/cart",
    protocol: "sync",
    trafficShare: 0.34,
  },
  {
    id: "edge-gateway-queue",
    source: "gateway",
    target: "order-queue",
    label: "/orders",
    protocol: "async",
    trafficShare: 0.24,
  },
  {
    id: "edge-product-lb-service",
    source: "product-lb",
    target: "product-service",
    label: "round-robin",
    protocol: "sync",
    trafficShare: 1,
  },
  {
    id: "edge-cart-lb-service",
    source: "cart-lb",
    target: "cart-service",
    label: "weighted",
    protocol: "sync",
    trafficShare: 1,
  },
  {
    id: "edge-product-service-cache",
    source: "product-service",
    target: "product-cache",
    label: "read-through",
    protocol: "sync",
    trafficShare: 0.7,
  },
  {
    id: "edge-product-service-db",
    source: "product-service",
    target: "product-db",
    label: "cache miss",
    protocol: "sync",
    trafficShare: 0.3,
  },
  {
    id: "edge-cache-db",
    source: "product-cache",
    target: "product-db",
    label: "miss refill",
    protocol: "sync",
    trafficShare: 0.28,
  },
  {
    id: "edge-cart-service-db",
    source: "cart-service",
    target: "cart-db",
    label: "persist cart",
    protocol: "sync",
    trafficShare: 1,
  },
  {
    id: "edge-queue-order-service",
    source: "order-queue",
    target: "order-service",
    label: "consume",
    protocol: "async",
    trafficShare: 1,
  },
  {
    id: "edge-order-service-payment",
    source: "order-service",
    target: "payment-service",
    label: "authorize",
    protocol: "sync",
    trafficShare: 0.82,
  },
  {
    id: "edge-order-service-db",
    source: "order-service",
    target: "order-db",
    label: "order state",
    protocol: "sync",
    trafficShare: 0.18,
  },
  {
    id: "edge-payment-db",
    source: "payment-service",
    target: "order-db",
    label: "payment record",
    protocol: "sync",
    trafficShare: 1,
  },
];

const stripeNodes: ArchitectureNode[] = [
  { id: "merchant-client", label: "Merchant SDK", kind: "client", x: 32, y: 108, domain: "Checkout", description: "Web and mobile payment SDK traffic from merchant storefronts.", endpoints: ["POST /payment-intents", "POST /confirm"], sourceRps: 14, instanceType: "m7i-large", memoryGb: 8, baseLatency: 10, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1 },
  { id: "partner-client", label: "Partner API", kind: "client", x: 32, y: 300, domain: "Platform", description: "Platform partners creating payouts and account events.", endpoints: ["POST /accounts", "POST /payouts"], sourceRps: 8, instanceType: "m7i-large", memoryGb: 8, baseLatency: 12, baseErrorRate: 0.012, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "gateway", label: "API Gateway", kind: "gateway", x: 254, y: 198, domain: "Ingress", description: "Authenticates merchants and routes payment requests.", endpoints: ["/payment-intents", "/confirm", "/accounts", "/payouts"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 20, baseErrorRate: 0.013, instances: 2, scaleMode: "auto", faultMode: "none", weight: 1.1 },
  { id: "payments-lb", label: "Payments LB", kind: "load-balancer", x: 492, y: 88, domain: "Payments", description: "Balances payment orchestration across regional workers.", endpoints: ["POST /payment-intents", "POST /confirm"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 12, baseErrorRate: 0.01, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.94 },
  { id: "accounts-lb", label: "Accounts LB", kind: "load-balancer", x: 492, y: 292, domain: "Platform", description: "Distributes account onboarding and payout jobs.", endpoints: ["POST /accounts", "POST /payouts"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 12, baseErrorRate: 0.012, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.98 },
  { id: "risk-service", label: "Risk Engine", kind: "service", x: 760, y: 56, domain: "Fraud", description: "Scores card and account activity for fraud signals.", endpoints: ["POST /score"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 58, baseErrorRate: 0.018, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.18 },
  { id: "payment-service", label: "Payment Orchestrator", kind: "service", x: 760, y: 172, domain: "Payments", description: "Creates intents, confirms charges, and drives processor calls.", endpoints: ["POST /payment-intents", "POST /confirm"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 82, baseErrorRate: 0.025, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.36 },
  { id: "payout-service", label: "Payout Service", kind: "service", x: 760, y: 292, domain: "Payouts", description: "Schedules disbursements and account transfers to merchants.", endpoints: ["POST /payouts"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 74, baseErrorRate: 0.022, instances: 2, scaleMode: "auto", faultMode: "none", weight: 1.28 },
  { id: "ledger-db", label: "Ledger DB", kind: "database", x: 1018, y: 182, domain: "Finance", description: "Immutable transaction ledger and balance records.", endpoints: ["ledger.write", "ledger.read"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 108, baseErrorRate: 0.022, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.58 },
  { id: "processor-cache", label: "Processor Cache", kind: "cache", x: 1018, y: 58, domain: "Routing", description: "Caches routing metadata and account capability lookups.", endpoints: ["processor:*"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 18, baseErrorRate: 0.008, instances: 1, scaleMode: "manual", faultMode: "none", weight: 0.82 },
  { id: "bank-queue", label: "Bank Queue", kind: "queue", x: 1018, y: 306, domain: "Settlement", description: "Buffers downstream settlement and webhook delivery events.", endpoints: ["SettlementPosted"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 28, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "processor-service", label: "Processor Adapter", kind: "service", x: 1260, y: 172, domain: "Acquiring", description: "Talks to card networks and payment processors.", endpoints: ["POST /authorize", "POST /capture"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 116, baseErrorRate: 0.034, instances: 2, scaleMode: "manual", faultMode: "none", weight: 1.48 },
];

const stripeEdges: ArchitectureEdge[] = [
  { id: "stripe-sdk-gateway", source: "merchant-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "stripe-partner-gateway", source: "partner-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "stripe-gateway-payments", source: "gateway", target: "payments-lb", label: "/payment-intents", protocol: "sync", trafficShare: 0.58 },
  { id: "stripe-gateway-accounts", source: "gateway", target: "accounts-lb", label: "/accounts", protocol: "sync", trafficShare: 0.42 },
  { id: "stripe-payments-risk", source: "payments-lb", target: "risk-service", label: "risk score", protocol: "sync", trafficShare: 0.54 },
  { id: "stripe-payments-orchestrator", source: "payments-lb", target: "payment-service", label: "route", protocol: "sync", trafficShare: 1 },
  { id: "stripe-accounts-payouts", source: "accounts-lb", target: "payout-service", label: "round-robin", protocol: "sync", trafficShare: 1 },
  { id: "stripe-risk-cache", source: "risk-service", target: "processor-cache", label: "routing cache", protocol: "sync", trafficShare: 0.64 },
  { id: "stripe-risk-ledger", source: "risk-service", target: "ledger-db", label: "watchlist", protocol: "sync", trafficShare: 0.24 },
  { id: "stripe-payments-ledger", source: "payment-service", target: "ledger-db", label: "ledger write", protocol: "sync", trafficShare: 0.74 },
  { id: "stripe-payments-processor", source: "payment-service", target: "processor-service", label: "authorize", protocol: "sync", trafficShare: 0.88 },
  { id: "stripe-payouts-ledger", source: "payout-service", target: "ledger-db", label: "balance read", protocol: "sync", trafficShare: 0.68 },
  { id: "stripe-payouts-queue", source: "payout-service", target: "bank-queue", label: "settlement", protocol: "async", trafficShare: 0.52 },
  { id: "stripe-processor-ledger", source: "processor-service", target: "ledger-db", label: "capture record", protocol: "sync", trafficShare: 1 },
];

const uberNodes: ArchitectureNode[] = [
  { id: "rider-client", label: "Rider App", kind: "client", x: 32, y: 96, domain: "Demand", description: "Mobile riders requesting trips and tracking ETA.", endpoints: ["POST /ride-requests", "GET /eta"], sourceRps: 16, instanceType: "m7i-large", memoryGb: 8, baseLatency: 12, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.02 },
  { id: "driver-client", label: "Driver App", kind: "client", x: 32, y: 286, domain: "Supply", description: "Drivers streaming location and trip state changes.", endpoints: ["POST /driver-status", "EVENT location.update"], sourceRps: 18, instanceType: "m7i-large", memoryGb: 8, baseLatency: 10, baseErrorRate: 0.012, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.08 },
  { id: "gateway", label: "Dispatch Gateway", kind: "gateway", x: 254, y: 192, domain: "Ingress", description: "Ingress for rider, driver, and marketplace APIs.", endpoints: ["/ride-requests", "/eta", "/driver-status"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 20, baseErrorRate: 0.014, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.14 },
  { id: "dispatch-lb", label: "Dispatch LB", kind: "load-balancer", x: 492, y: 86, domain: "Trips", description: "Distributes trip matching and surge lookups.", endpoints: ["POST /ride-requests", "GET /eta"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 10, baseErrorRate: 0.01, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.9 },
  { id: "events-lb", label: "Realtime LB", kind: "load-balancer", x: 492, y: 286, domain: "Realtime", description: "Balances websocket and telemetry ingestion.", endpoints: ["EVENT location.update", "POST /driver-status"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 12, baseErrorRate: 0.012, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.96 },
  { id: "matching-service", label: "Matching Engine", kind: "service", x: 760, y: 70, domain: "Marketplace", description: "Matches riders and drivers using geo and ETA signals.", endpoints: ["POST /ride-requests"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 68, baseErrorRate: 0.022, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.32 },
  { id: "pricing-service", label: "Pricing Service", kind: "service", x: 760, y: 176, domain: "Marketplace", description: "Computes fares, surge pricing, and wait-time estimates.", endpoints: ["GET /eta", "GET /fare"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 62, baseErrorRate: 0.019, instances: 2, scaleMode: "auto", faultMode: "none", weight: 1.24 },
  { id: "location-queue", label: "Location Stream", kind: "queue", x: 760, y: 296, domain: "Realtime", description: "Buffers high-volume driver location updates for consumers.", endpoints: ["DriverLocationUpdated"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 24, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.02 },
  { id: "geo-cache", label: "Geo Cache", kind: "cache", x: 1018, y: 64, domain: "Realtime", description: "Caches active supply, map tiles, and ETA fragments.", endpoints: ["geo:*"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 18, baseErrorRate: 0.008, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.8 },
  { id: "trip-db", label: "Trip DB", kind: "database", x: 1018, y: 182, domain: "Trips", description: "Stores trip lifecycle, ETA snapshots, and marketplace state.", endpoints: ["trips.write", "trips.read"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 112, baseErrorRate: 0.022, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.6 },
  { id: "driver-db", label: "Driver DB", kind: "database", x: 1260, y: 64, domain: "Supply", description: "Stores driver profile, shifts, and compliance data.", endpoints: ["drivers.read", "drivers.write"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 104, baseErrorRate: 0.02, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.54 },
  { id: "notifier-service", label: "Notification Service", kind: "service", x: 1260, y: 286, domain: "Comms", description: "Pushes trip updates, SMS fallbacks, and driver alerts.", endpoints: ["POST /notify"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 74, baseErrorRate: 0.026, instances: 2, scaleMode: "manual", faultMode: "none", weight: 1.22 },
];

const uberEdges: ArchitectureEdge[] = [
  { id: "uber-rider-gateway", source: "rider-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "uber-driver-gateway", source: "driver-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "uber-gateway-dispatch", source: "gateway", target: "dispatch-lb", label: "/ride-requests", protocol: "sync", trafficShare: 0.58 },
  { id: "uber-gateway-realtime", source: "gateway", target: "events-lb", label: "driver status", protocol: "sync", trafficShare: 0.42 },
  { id: "uber-dispatch-matching", source: "dispatch-lb", target: "matching-service", label: "match rider", protocol: "sync", trafficShare: 0.74 },
  { id: "uber-dispatch-pricing", source: "dispatch-lb", target: "pricing-service", label: "quote fare", protocol: "sync", trafficShare: 0.6 },
  { id: "uber-events-queue", source: "events-lb", target: "location-queue", label: "location events", protocol: "async", trafficShare: 1 },
  { id: "uber-matching-cache", source: "matching-service", target: "geo-cache", label: "nearby drivers", protocol: "sync", trafficShare: 0.72 },
  { id: "uber-matching-tripdb", source: "matching-service", target: "trip-db", label: "trip create", protocol: "sync", trafficShare: 0.44 },
  { id: "uber-pricing-cache", source: "pricing-service", target: "geo-cache", label: "ETA cache", protocol: "sync", trafficShare: 0.66 },
  { id: "uber-pricing-tripdb", source: "pricing-service", target: "trip-db", label: "fare policy", protocol: "sync", trafficShare: 0.3 },
  { id: "uber-queue-cache", source: "location-queue", target: "geo-cache", label: "stream update", protocol: "async", trafficShare: 0.82 },
  { id: "uber-queue-driverdb", source: "location-queue", target: "driver-db", label: "presence sync", protocol: "async", trafficShare: 0.34 },
  { id: "uber-tripdb-notify", source: "trip-db", target: "notifier-service", label: "trip updates", protocol: "async", trafficShare: 0.42 },
];

const facebookNodes: ArchitectureNode[] = [
  { id: "web-client", label: "Web Feed", kind: "client", x: 32, y: 94, domain: "Consumer", description: "Browser clients loading home feed and comments.", endpoints: ["GET /feed", "POST /comments"], sourceRps: 20, instanceType: "m7i-large", memoryGb: 8, baseLatency: 10, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "mobile-client", label: "Mobile App", kind: "client", x: 32, y: 292, domain: "Consumer", description: "Mobile sessions posting stories, reactions, and messages.", endpoints: ["GET /feed", "POST /stories"], sourceRps: 26, instanceType: "m7i-large", memoryGb: 8, baseLatency: 12, baseErrorRate: 0.012, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.08 },
  { id: "gateway", label: "Social Gateway", kind: "gateway", x: 254, y: 194, domain: "Ingress", description: "API entry point for feed, social graph, and content requests.", endpoints: ["/feed", "/stories", "/comments", "/reactions"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 20, baseErrorRate: 0.014, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.12 },
  { id: "feed-lb", label: "Feed LB", kind: "load-balancer", x: 492, y: 82, domain: "Feed", description: "Balances read-heavy feed and reaction traffic.", endpoints: ["GET /feed", "POST /reactions"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 10, baseErrorRate: 0.01, instances: 3, scaleMode: "manual", faultMode: "none", weight: 0.92 },
  { id: "content-lb", label: "Content LB", kind: "load-balancer", x: 492, y: 286, domain: "Content", description: "Distributes story, photo, and comment writes.", endpoints: ["POST /stories", "POST /comments"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 12, baseErrorRate: 0.012, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.98 },
  { id: "feed-service", label: "Feed Ranker", kind: "service", x: 760, y: 62, domain: "Feed", description: "Builds and ranks personalized home feeds.", endpoints: ["GET /feed"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 84, baseErrorRate: 0.024, instances: 4, scaleMode: "auto", faultMode: "none", weight: 1.4 },
  { id: "graph-service", label: "Social Graph", kind: "service", x: 760, y: 172, domain: "Graph", description: "Resolves follows, friends, and audience permissions.", endpoints: ["GET /edges"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 72, baseErrorRate: 0.02, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.28 },
  { id: "media-queue", label: "Media Queue", kind: "queue", x: 760, y: 292, domain: "Media", description: "Buffers image/video processing jobs from content uploads.", endpoints: ["MediaUploaded"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 24, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "feed-cache", label: "Feed Cache", kind: "cache", x: 1018, y: 62, domain: "Feed", description: "Caches hot feed slices and graph fanout fragments.", endpoints: ["feed:*"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 18, baseErrorRate: 0.008, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.82 },
  { id: "content-db", label: "Content DB", kind: "database", x: 1018, y: 184, domain: "Content", description: "Stores posts, comments, reactions, and metadata.", endpoints: ["content.read", "content.write"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 114, baseErrorRate: 0.024, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.62 },
  { id: "graph-db", label: "Graph DB", kind: "database", x: 1260, y: 68, domain: "Graph", description: "Stores relationship edges and fanout materializations.", endpoints: ["graph.read", "graph.write"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 104, baseErrorRate: 0.021, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.56 },
  { id: "moderation-service", label: "Moderation", kind: "service", x: 1260, y: 292, domain: "Safety", description: "Scores uploads and comments for policy compliance.", endpoints: ["POST /moderate"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 76, baseErrorRate: 0.026, instances: 2, scaleMode: "manual", faultMode: "none", weight: 1.22 },
];

const facebookEdges: ArchitectureEdge[] = [
  { id: "fb-web-gateway", source: "web-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "fb-mobile-gateway", source: "mobile-client", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "fb-gateway-feed", source: "gateway", target: "feed-lb", label: "/feed", protocol: "sync", trafficShare: 0.62 },
  { id: "fb-gateway-content", source: "gateway", target: "content-lb", label: "/stories", protocol: "sync", trafficShare: 0.38 },
  { id: "fb-feed-ranker", source: "feed-lb", target: "feed-service", label: "rank request", protocol: "sync", trafficShare: 1 },
  { id: "fb-feed-graph", source: "feed-lb", target: "graph-service", label: "social graph", protocol: "sync", trafficShare: 0.72 },
  { id: "fb-content-queue", source: "content-lb", target: "media-queue", label: "media ingest", protocol: "async", trafficShare: 0.46 },
  { id: "fb-content-graph", source: "content-lb", target: "graph-service", label: "audience check", protocol: "sync", trafficShare: 0.36 },
  { id: "fb-feed-cache", source: "feed-service", target: "feed-cache", label: "fanout cache", protocol: "sync", trafficShare: 0.74 },
  { id: "fb-feed-contentdb", source: "feed-service", target: "content-db", label: "hydrate posts", protocol: "sync", trafficShare: 0.38 },
  { id: "fb-graph-cache", source: "graph-service", target: "feed-cache", label: "edge cache", protocol: "sync", trafficShare: 0.58 },
  { id: "fb-graph-db", source: "graph-service", target: "graph-db", label: "edge lookup", protocol: "sync", trafficShare: 0.54 },
  { id: "fb-queue-moderation", source: "media-queue", target: "moderation-service", label: "scan media", protocol: "async", trafficShare: 0.82 },
  { id: "fb-moderation-contentdb", source: "moderation-service", target: "content-db", label: "content decision", protocol: "sync", trafficShare: 0.6 },
];

const binanceNodes: ArchitectureNode[] = [
  { id: "trader-web", label: "Trader Web", kind: "client", x: 32, y: 90, domain: "Retail", description: "Browser users placing spot orders and checking balances.", endpoints: ["POST /orders", "GET /balances"], sourceRps: 18, instanceType: "m7i-large", memoryGb: 8, baseLatency: 10, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "market-maker", label: "Market Maker API", kind: "client", x: 32, y: 286, domain: "Institutional", description: "High-frequency bots streaming quotes and cancelling orders.", endpoints: ["POST /orders", "DELETE /orders"], sourceRps: 28, instanceType: "m7i-large", memoryGb: 8, baseLatency: 8, baseErrorRate: 0.012, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.12 },
  { id: "gateway", label: "Exchange Gateway", kind: "gateway", x: 254, y: 188, domain: "Ingress", description: "Entry point for order placement, balances, and account auth.", endpoints: ["/orders", "/balances", "/withdrawals"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 18, baseErrorRate: 0.014, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.14 },
  { id: "order-lb", label: "Order Entry LB", kind: "load-balancer", x: 492, y: 82, domain: "Trading", description: "Balances order creation and cancellation traffic.", endpoints: ["POST /orders", "DELETE /orders"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 10, baseErrorRate: 0.01, instances: 3, scaleMode: "manual", faultMode: "none", weight: 0.92 },
  { id: "wallet-lb", label: "Wallet LB", kind: "load-balancer", x: 492, y: 286, domain: "Accounts", description: "Distributes account balance and withdrawal operations.", endpoints: ["GET /balances", "POST /withdrawals"], sourceRps: 0, instanceType: "c6i-large", memoryGb: 4, baseLatency: 12, baseErrorRate: 0.012, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.98 },
  { id: "matching-service", label: "Matching Engine", kind: "service", x: 760, y: 68, domain: "Trading", description: "Matches bids and asks on the order book.", endpoints: ["POST /orders"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 46, baseErrorRate: 0.018, instances: 4, scaleMode: "auto", faultMode: "none", weight: 1.4 },
  { id: "risk-service", label: "Risk Service", kind: "service", x: 760, y: 176, domain: "Controls", description: "Checks margin, exposure, and account limits before fill.", endpoints: ["POST /risk-check"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 56, baseErrorRate: 0.019, instances: 3, scaleMode: "auto", faultMode: "none", weight: 1.26 },
  { id: "settlement-queue", label: "Settlement Queue", kind: "queue", x: 760, y: 292, domain: "Post-trade", description: "Queues fills, ledger writes, and outbound notifications.", endpoints: ["TradeFilled"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 24, baseErrorRate: 0.01, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.04 },
  { id: "order-cache", label: "Order Book Cache", kind: "cache", x: 1018, y: 68, domain: "Trading", description: "Caches top-of-book and recent depth snapshots.", endpoints: ["orderbook:*"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 16, baseErrorRate: 0.008, instances: 2, scaleMode: "manual", faultMode: "none", weight: 0.78 },
  { id: "ledger-db", label: "Ledger DB", kind: "database", x: 1018, y: 184, domain: "Accounts", description: "Stores balances, fills, transfers, and compliance events.", endpoints: ["ledger.read", "ledger.write"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 108, baseErrorRate: 0.022, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.58 },
  { id: "wallet-service", label: "Wallet Service", kind: "service", x: 1260, y: 68, domain: "Accounts", description: "Serves balances, deposits, and withdrawal workflows.", endpoints: ["GET /balances", "POST /withdrawals"], sourceRps: 0, instanceType: "m7i-large", memoryGb: 8, baseLatency: 72, baseErrorRate: 0.022, instances: 2, scaleMode: "auto", faultMode: "none", weight: 1.22 },
  { id: "compliance-db", label: "Compliance DB", kind: "database", x: 1260, y: 292, domain: "Compliance", description: "Stores KYC, screening, and audit evidence.", endpoints: ["kyc.read", "audit.write"], sourceRps: 0, instanceType: "r6i-large", memoryGb: 16, baseLatency: 112, baseErrorRate: 0.024, instances: 1, scaleMode: "manual", faultMode: "none", weight: 1.54 },
];

const binanceEdges: ArchitectureEdge[] = [
  { id: "bn-web-gateway", source: "trader-web", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "bn-maker-gateway", source: "market-maker", target: "gateway", label: "HTTPS", protocol: "sync", trafficShare: 1 },
  { id: "bn-gateway-order", source: "gateway", target: "order-lb", label: "/orders", protocol: "sync", trafficShare: 0.68 },
  { id: "bn-gateway-wallet", source: "gateway", target: "wallet-lb", label: "/balances", protocol: "sync", trafficShare: 0.32 },
  { id: "bn-order-matching", source: "order-lb", target: "matching-service", label: "match", protocol: "sync", trafficShare: 1 },
  { id: "bn-order-risk", source: "order-lb", target: "risk-service", label: "pre-trade", protocol: "sync", trafficShare: 0.78 },
  { id: "bn-wallet-service", source: "wallet-lb", target: "wallet-service", label: "wallet ops", protocol: "sync", trafficShare: 1 },
  { id: "bn-matching-cache", source: "matching-service", target: "order-cache", label: "book read", protocol: "sync", trafficShare: 0.82 },
  { id: "bn-matching-queue", source: "matching-service", target: "settlement-queue", label: "fill event", protocol: "async", trafficShare: 0.68 },
  { id: "bn-risk-ledger", source: "risk-service", target: "ledger-db", label: "balance check", protocol: "sync", trafficShare: 0.54 },
  { id: "bn-risk-compliance", source: "risk-service", target: "compliance-db", label: "screening", protocol: "sync", trafficShare: 0.26 },
  { id: "bn-queue-ledger", source: "settlement-queue", target: "ledger-db", label: "settle fill", protocol: "async", trafficShare: 0.88 },
  { id: "bn-queue-compliance", source: "settlement-queue", target: "compliance-db", label: "audit trail", protocol: "async", trafficShare: 0.22 },
  { id: "bn-wallet-ledger", source: "wallet-service", target: "ledger-db", label: "balance write", protocol: "sync", trafficShare: 0.72 },
];

export const DEFAULT_ARCHITECTURE_ID = "ecommerce";

export const ARCHITECTURE_PRESETS: ArchitecturePreset[] = [
  {
    id: "ecommerce",
    name: "E-Commerce Platform",
    description: "Catalog, cart, orders, and payments across a retail storefront.",
    nodes: initialNodes,
    edges: initialEdges,
    traffic: initialTraffic,
  },
  {
    id: "stripe",
    name: "Payment Gateway",
    description: "Stripe-style payment orchestration, risk checks, and settlement flows.",
    nodes: stripeNodes,
    edges: stripeEdges,
    traffic: { speed: 1, failureBias: 0.05 },
  },
  {
    id: "uber",
    name: "Ride Hailing",
    description: "Uber-style dispatch, realtime location, and trip marketplace services.",
    nodes: uberNodes,
    edges: uberEdges,
    traffic: { speed: 1, failureBias: 0.05 },
  },
  {
    id: "facebook",
    name: "Social Media",
    description: "Facebook-style feed ranking, graph access, and content moderation.",
    nodes: facebookNodes,
    edges: facebookEdges,
    traffic: { speed: 1, failureBias: 0.045 },
  },
  {
    id: "binance",
    name: "Crypto Exchange",
    description: "Binance-style order entry, matching, wallet operations, and settlement.",
    nodes: binanceNodes,
    edges: binanceEdges,
    traffic: { speed: 1, failureBias: 0.055 },
  },
];

export function getArchitecturePreset(id: string) {
  return ARCHITECTURE_PRESETS.find((preset) => preset.id === id) ?? ARCHITECTURE_PRESETS[0];
}

export const kindAppearance: Record<
  NodeKind,
  { badge: string; tint: string; stroke: string; icon: string }
> = {
  client: {
    badge: "Client",
    tint: "from-cyan-400/18 to-sky-400/6",
    stroke: "rgba(88, 215, 255, 0.5)",
    icon: "CL",
  },
  gateway: {
    badge: "Gateway",
    tint: "from-teal-300/20 to-cyan-400/8",
    stroke: "rgba(94, 234, 212, 0.56)",
    icon: "GW",
  },
  "load-balancer": {
    badge: "Balancer",
    tint: "from-amber-300/22 to-orange-400/8",
    stroke: "rgba(255, 182, 92, 0.5)",
    icon: "LB",
  },
  service: {
    badge: "Service",
    tint: "from-violet-300/18 to-fuchsia-400/8",
    stroke: "rgba(177, 156, 255, 0.48)",
    icon: "SV",
  },
  database: {
    badge: "Database",
    tint: "from-rose-300/20 to-pink-400/8",
    stroke: "rgba(255, 111, 125, 0.52)",
    icon: "DB",
  },
  cache: {
    badge: "Cache",
    tint: "from-emerald-300/22 to-lime-400/8",
    stroke: "rgba(86, 227, 159, 0.5)",
    icon: "RC",
  },
  queue: {
    badge: "Queue",
    tint: "from-blue-300/18 to-indigo-400/8",
    stroke: "rgba(125, 161, 255, 0.5)",
    icon: "MQ",
  },
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value < 1000 ? 0 : 1,
  }).format(value);
}

const REQUEST_METHODS: RequestMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "EVENT",
];

export function parseEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return { method: "GET" as RequestMethod, path: "/" };
  }

  const [head, ...rest] = trimmed.split(/\s+/);
  const maybeMethod = head.toUpperCase() as RequestMethod;
  if (REQUEST_METHODS.includes(maybeMethod)) {
    return {
      method: maybeMethod,
      path: rest.join(" ") || "/",
    };
  }

  if (trimmed.startsWith("/")) {
    return { method: "GET" as RequestMethod, path: trimmed };
  }

  return { method: "EVENT" as RequestMethod, path: trimmed };
}

export function formatEndpoint(method: RequestMethod, path: string) {
  return method === "EVENT" ? path : `${method} ${path}`;
}

function mergeRouteFlows(flows: RouteFlow[]) {
  const merged = new Map<string, RouteFlow>();

  for (const flow of flows) {
    const current = merged.get(flow.key);
    if (current) {
      current.rps += flow.rps;
      continue;
    }

    merged.set(flow.key, { ...flow });
  }

  return [...merged.values()].sort((left, right) => right.rps - left.rps);
}

function createRouteFlowsFromEndpoints(endpoints: string[], totalRps: number) {
  const parsedEndpoints = endpoints.length > 0 ? endpoints : ["GET /"];
  const useIntegerSplit = Number.isInteger(totalRps);
  const baseRps = useIntegerSplit
    ? Math.floor(totalRps / parsedEndpoints.length)
    : totalRps / parsedEndpoints.length;
  const remainder = useIntegerSplit
    ? totalRps - baseRps * parsedEndpoints.length
    : 0;

  return parsedEndpoints.map((endpoint, index) => {
    const { method, path } = parseEndpoint(endpoint);
    return {
      key: `${method}:${path}`,
      method,
      path,
      rps: useIntegerSplit && index < remainder ? baseRps + 1 : baseRps,
    } satisfies RouteFlow;
  });
}

function routeFlowsForDisplay(node: ArchitectureNode, flows: RouteFlow[]) {
  const defaults = node.endpoints.map((endpoint) => {
    const { method, path } = parseEndpoint(endpoint);
    return {
      key: `${method}:${path}`,
      method,
      path,
      rps: 0,
    } satisfies RouteFlow;
  });

  return mergeRouteFlows([...defaults, ...flows]).slice(0, 4);
}

function scaleRouteFlows(flows: RouteFlow[], ratio: number) {
  if (ratio <= 0) {
    return [] as RouteFlow[];
  }

  return flows
    .map((flow) => ({
      ...flow,
      rps: flow.rps * ratio,
    }))
    .filter((flow) => flow.rps > 0);
}

export function getCloudInstanceProfile(instanceType: CloudInstanceType) {
  return (
    CLOUD_INSTANCE_OPTIONS.find((option) => option.id === instanceType) ??
    CLOUD_INSTANCE_OPTIONS[0]
  );
}

export function getNodeProcessingCapacity(node: ArchitectureNode) {
  const profile = getCloudInstanceProfile(node.instanceType);
  const memoryFactor = Math.max(0.85, node.memoryGb / profile.memoryGb);
  const kindFactor =
    node.kind === "gateway" || node.kind === "load-balancer"
      ? 1.35
      : node.kind === "cache"
        ? 1.55
        : node.kind === "database"
          ? 0.92
          : node.kind === "queue"
            ? 1.18
            : node.kind === "client"
              ? 1.9
              : 1;

  return profile.baselineRps * memoryFactor * kindFactor;
}

export function buildNodeFromPalette(kind: NodeKind, index: number) {
  const definition = COMPONENT_LIBRARY.find((item) => item.kind === kind);
  const baseLabel = definition?.label ?? "Component";
  const slug = baseLabel.toLowerCase().replace(/\s+/g, "-");
  return {
    id: `${slug}-${index}`,
    label: `${baseLabel} ${index}`,
    kind,
    x: 220 + ((index - 1) % 3) * 280,
    y: 480 + Math.floor((index - 1) / 3) * 190,
    domain: kind === "service" ? "New Domain" : "Expansion",
    description: definition?.description ?? "New component",
    endpoints: [kind === "client" ? "GET /new-endpoint" : "/new-endpoint"],
    sourceRps: kind === "client" ? 240 : 0,
    instanceType: definition?.defaults.instanceType ?? "m7i-large",
    memoryGb: definition?.defaults.memoryGb ?? 8,
    baseLatency: definition?.defaults.baseLatency ?? 40,
    baseErrorRate: 0.02,
    instances: 1,
    scaleMode: "manual" as ScaleMode,
    faultMode: "none" as FaultMode,
    weight: definition?.defaults.weight ?? 1,
  } satisfies ArchitectureNode;
}

export function autoLayout(nodes: ArchitectureNode[]) {
  const columns: Record<NodeKind, number> = {
    client: 32,
    gateway: 340,
    "load-balancer": 680,
    service: 1050,
    database: 1810,
    cache: 1440,
    queue: 1360,
  };

  const rowCounts: Partial<Record<NodeKind, number>> = {};

  return nodes.map((node) => {
    const count = rowCounts[node.kind] ?? 0;
    rowCounts[node.kind] = count + 1;
    return {
      ...node,
      x: columns[node.kind],
      y: 56 + count * 184,
    };
  });
}

export function createTimelineEvent(
  tick: number,
  snapshot: SimulationSnapshot,
): TimelineEvent {
  const head = snapshot.hotSpots[0];

  if (!head) {
    return {
      id: `tick-${tick}`,
      tick,
      headline: "Flow stable",
      detail: "All critical components are staying within comfortable limits.",
      severity: "info",
    } satisfies TimelineEvent;
  }

  const metric = snapshot.nodeMetrics[head.id];

  if (!metric) {
    return {
      id: `tick-${tick}`,
      tick,
      headline: "Signal drift detected",
      detail: "A hotspot was identified, but its metric sample was unavailable for this tick.",
      severity: "warn",
    };
  }

  const severity =
    metric.status === "failing"
      ? "critical"
      : metric.status === "degraded"
        ? "warn"
        : "info";

  return {
    id: `tick-${tick}`,
    tick,
    headline: `${head.label} is heating up`,
    detail: `${formatCompact(metric.incomingRps)} RPS at ${metric.cpu.toFixed(0)}% CPU with ${metric.latency.toFixed(0)} ms latency.`,
    severity,
  };
}

export function applyScenario(
  scenarioId: string,
  nodes: ArchitectureNode[],
  traffic: TrafficProfile,
) {
  const nextNodes = nodes.map((node) => ({ ...node }));
  const nextTraffic = { ...traffic };

  for (const node of nextNodes) {
    node.faultMode = "none";
  }

  if (scenarioId === "surge") {
    nextTraffic.failureBias = 0.08;
    for (const node of nextNodes) {
      if (node.kind === "client") {
        node.sourceRps = Math.round(node.sourceRps * 1.9);
      }
    }
  }

  if (scenarioId === "payment-failure") {
    nextTraffic.failureBias = 0.16;
    for (const node of nextNodes) {
      if (node.kind === "client") {
        node.sourceRps = Math.round(node.sourceRps * 1.22);
      }
    }
    const payment = nextNodes.find((node) => node.id === "payment-service");
    if (payment) {
      payment.faultMode = "crash";
    }
  }

  if (scenarioId === "database-slowdown") {
    nextTraffic.failureBias = 0.11;
    for (const node of nextNodes) {
      if (node.kind === "client") {
        node.sourceRps = Math.round(node.sourceRps * 1.12);
      }
    }
    const db = nextNodes.find((node) => node.id === "order-db");
    if (db) {
      db.faultMode = "latency";
      db.baseLatency += 60;
    }
  }

  if (scenarioId === "cache-hot") {
    for (const node of nextNodes) {
      if (node.kind === "client") {
        node.sourceRps = Math.round(node.sourceRps * 1.38);
      }
    }
    const cache = nextNodes.find((node) => node.id === "product-cache");
    if (cache) {
      cache.instances = 2;
    }
    const productDb = nextNodes.find((node) => node.id === "product-db");
    if (productDb) {
      productDb.baseLatency = Math.max(74, productDb.baseLatency - 26);
    }
  }

  return { nodes: nextNodes, traffic: nextTraffic };
}

export function simulateNetwork(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  traffic: TrafficProfile,
): SimulationSnapshot {
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const outgoing = Object.groupBy(edges, (edge) => edge.source);
  const incoming = Object.groupBy(edges, (edge) => edge.target);
  const incomingLoad: Record<string, number> = {};
  const incomingRoutes: Record<string, RouteFlow[]> = {};
  const nodeMetrics: Record<string, NodeMetrics> = {};
  const edgeMetrics: Record<string, EdgeMetrics> = {};
  const nodeRoutes: Record<string, RouteFlow[]> = {};
  const edgeForwardRoutes: Record<string, RouteFlow[]> = {};
  const edgeReturnRoutes: Record<string, RouteFlow[]> = {};
  const edgeReturnRps: Record<string, number> = {};

  for (const node of nodes) {
    incomingLoad[node.id] = 0;
    incomingRoutes[node.id] = [];
  }

  const clients = nodes.filter((node) => node.kind === "client");

  for (const node of clients) {
    incomingLoad[node.id] = Math.max(node.sourceRps, 0);
    incomingRoutes[node.id] = createRouteFlowsFromEndpoints(
      node.endpoints,
      incomingLoad[node.id],
    );
  }

  const orderedNodes = [...nodes].sort((left, right) => left.x - right.x);

  for (const node of orderedNodes) {
    const currentRoutes = mergeRouteFlows(incomingRoutes[node.id] ?? []);
    const currentLoad = incomingLoad[node.id] ?? 0;
    const dependencyCount = (outgoing[node.id] ?? []).length;
    const nextEdges = outgoing[node.id] ?? [];
    const incomingEdges = incoming[node.id] ?? [];
    const perInstanceCapacity = getNodeProcessingCapacity(node);
    const effectiveCapacity = Math.max(perInstanceCapacity * node.instances, 1);
    const overloadRatio = currentLoad / effectiveCapacity;
    const receivesSyncTraffic = incomingEdges.some(
      (edge) => edge.protocol === "sync",
    );
    const missingCriticalDependency =
      currentLoad > 0 &&
      nextEdges.length === 0 &&
      (node.kind === "gateway" ||
        node.kind === "load-balancer" ||
        (node.kind === "service" && receivesSyncTraffic));

    const faultPenalty =
      node.faultMode === "latency"
        ? { latency: 110, error: 0.05, throughput: 0.82, cpu: 12 }
        : node.faultMode === "timeout"
          ? { latency: 190, error: 0.12, throughput: 0.58, cpu: 18 }
        : node.faultMode === "crash"
            ? { latency: 320, error: 0.64, throughput: 0.03, cpu: 26 }
            : { latency: 0, error: 0, throughput: 1, cpu: 0 };
    const dependencyPenalty = missingCriticalDependency
      ? { latency: 180, error: 0.72, throughput: 0.06, cpu: 10 }
      : { latency: 0, error: 0, throughput: 1, cpu: 0 };

    const cacheHitRate =
      node.kind === "cache"
        ? clamp(0.88 - overloadRatio * 0.12 + node.instances * 0.04, 0.42, 0.99)
        : 0;
    const queueDepth =
      node.kind === "queue"
        ? Math.max(0, currentLoad - effectiveCapacity) * 8
        : 0;

    const latency =
      node.baseLatency +
      Math.max(0, overloadRatio - 0.78) * node.baseLatency * 1.95 +
      dependencyCount * 6 +
      queueDepth * 0.05 +
      faultPenalty.latency +
      dependencyPenalty.latency;

    const errorRate = clamp(
      node.baseErrorRate +
        Math.max(0, overloadRatio - 0.92) * 0.28 +
        traffic.failureBias +
        dependencyCount * 0.004 +
        faultPenalty.error +
        dependencyPenalty.error,
      0.004,
      0.98,
    );

    const cpu =
      currentLoad <= 0
        ? clamp(faultPenalty.cpu, 0, 99)
        : clamp(
            overloadRatio * 78 +
              Math.max(node.instances - 1, 0) * 2 +
              dependencyCount * 1.5 +
              faultPenalty.cpu +
              dependencyPenalty.cpu,
            0,
            99,
          );

    const throughputCapacity =
      node.kind === "client"
        ? currentLoad
        : effectiveCapacity * faultPenalty.throughput * dependencyPenalty.throughput;
    const throughput = Math.min(currentLoad, throughputCapacity);
    const throughputRatio = currentLoad > 0 ? throughput / currentLoad : 0;
    const status =
      node.kind === "client"
        ? "healthy"
        : node.faultMode === "crash" ||
            missingCriticalDependency ||
            cpu > 91 ||
            errorRate > 0.22
          ? "failing"
          : cpu > 74 || errorRate > 0.08 || latency > 220
            ? "degraded"
            : "healthy";

    nodeMetrics[node.id] = {
      id: node.id,
      incomingRps: currentLoad,
      throughput,
      emittedRps: 0,
      processingCapacity: effectiveCapacity,
      availability: 1 - errorRate,
      latency,
      cpu,
      errorRate,
      overloadRatio,
      queueDepth,
      cacheHitRate,
      status,
      suggestedInstances: Math.max(1, Math.ceil((currentLoad / perInstanceCapacity) * 1.08)),
    };
    nodeRoutes[node.id] = routeFlowsForDisplay(node, currentRoutes);
    let emittedRps = 0;
    const edgeFlowMap = new Map<string, RouteFlow[]>();

    for (const edge of nextEdges) {
      edgeFlowMap.set(edge.id, []);
    }

    for (const route of currentRoutes) {
      const routeEdges = nextEdges.filter((edge) => edge.label === route.path);
      const genericEdges = nextEdges.filter((edge) => !edge.label.startsWith("/"));
      const candidateEdges =
        routeEdges.length > 0
          ? routeEdges
          : genericEdges.length > 0
            ? genericEdges
            : nextEdges;
      const totalShare = candidateEdges.reduce(
        (sum, edge) => sum + edge.trafficShare,
        0,
      );
      const normalizedTotalShare = totalShare > 0 ? totalShare : 1;

      for (const edge of candidateEdges) {
        const currentEdgeFlows = edgeFlowMap.get(edge.id);
        if (!currentEdgeFlows) {
          continue;
        }

        currentEdgeFlows.push({
          ...route,
          rps:
            route.rps *
            throughputRatio *
            (edge.trafficShare / normalizedTotalShare),
        });
      }
    }

    for (const edge of nextEdges) {
      const destination = nodesById[edge.target];
      if (!destination) {
        continue;
      }

      const routedFlows = edgeFlowMap.get(edge.id) ?? [];
      edgeForwardRoutes[edge.id] = mergeRouteFlows(routedFlows);
      const routedRps = routedFlows.reduce((sum, route) => sum + route.rps, 0);
      emittedRps += routedRps;
      incomingLoad[edge.target] = (incomingLoad[edge.target] ?? 0) + routedRps;
      incomingRoutes[edge.target] = [
        ...(incomingRoutes[edge.target] ?? []),
        ...routedFlows,
      ];

      edgeMetrics[edge.id] = {
        id: edge.id,
        rps: routedRps,
        returnRps: 0,
        errorRate,
        latency:
          latency +
          (edge.protocol === "async" ? 30 : 10) +
          destination.baseLatency * 0.12,
      };
    }

    nodeMetrics[node.id].emittedRps =
      nextEdges.length > 0 ? emittedRps : throughput;
  }

  const metricList = Object.values(nodeMetrics);
  const serverMetrics = metricList.filter((metric) => nodesById[metric.id]?.kind !== "client");
  const successfulProcessingRps: Record<string, number> = {};
  const returnedRoutesByNode: Record<string, RouteFlow[]> = {};

  for (const metric of metricList) {
    successfulProcessingRps[metric.id] = metric.throughput * metric.availability;
  }

  for (const node of [...orderedNodes].reverse()) {
    const metric = nodeMetrics[node.id];
    if (!metric) {
      continue;
    }

    const currentRoutes = mergeRouteFlows(incomingRoutes[node.id] ?? []);
    const nextEdges = outgoing[node.id] ?? [];
    const localSuccessRatio =
      node.kind === "client"
        ? 1
        : metric.incomingRps > 0
        ? clamp(successfulProcessingRps[node.id] / metric.incomingRps, 0, 1)
        : 0;
    const localSuccessfulRoutes = scaleRouteFlows(currentRoutes, localSuccessRatio);
    const downstreamReturnedFlows = nextEdges.flatMap((edge) => {
      const destinationMetric = nodeMetrics[edge.target];
      if (!destinationMetric) {
        edgeReturnRoutes[edge.id] = [];
        edgeReturnRps[edge.id] = 0;
        return [];
      }

      const forwardFlows = edgeForwardRoutes[edge.id] ?? [];
      if (forwardFlows.length === 0 || destinationMetric.incomingRps <= 0) {
        edgeReturnRoutes[edge.id] = [];
        edgeReturnRps[edge.id] = 0;
        return [];
      }

      let returnedFlows: RouteFlow[] = [];

      if (edge.protocol === "async") {
        const destinationSuccessRatio = clamp(
          successfulProcessingRps[edge.target] / destinationMetric.incomingRps,
          0,
          1,
        );
        returnedFlows = scaleRouteFlows(forwardFlows, destinationSuccessRatio);
      } else {
        const targetReturnedRoutes = mergeRouteFlows(returnedRoutesByNode[edge.target] ?? []);
        const targetReturnedByKey = new Map(
          targetReturnedRoutes.map((route) => [route.key, route.rps]),
        );
        const targetIncomingByKey = new Map(
          mergeRouteFlows(incomingRoutes[edge.target] ?? []).map((route) => [route.key, route.rps]),
        );

        returnedFlows = forwardFlows
          .map((route) => {
            const targetReturned = targetReturnedByKey.get(route.key) ?? 0;
            const targetIncoming = targetIncomingByKey.get(route.key) ?? 0;
            const routeReturnRatio =
              targetIncoming > 0 ? clamp(targetReturned / targetIncoming, 0, 1) : 0;
            return {
              ...route,
              rps: route.rps * routeReturnRatio,
            };
          })
          .filter((route) => route.rps > 0);
      }

      const mergedReturnedFlows = mergeRouteFlows(returnedFlows);
      edgeReturnRoutes[edge.id] = mergedReturnedFlows;
      edgeReturnRps[edge.id] = mergedReturnedFlows.reduce(
        (sum, route) => sum + route.rps,
        0,
      );
      return mergedReturnedFlows;
    });

    if (nextEdges.length === 0) {
      returnedRoutesByNode[node.id] = localSuccessfulRoutes;
      continue;
    }

    const downstreamReturnedByKey = new Map(
      mergeRouteFlows(downstreamReturnedFlows).map((route) => [route.key, route.rps]),
    );
    returnedRoutesByNode[node.id] = localSuccessfulRoutes
      .map((route) => ({
        ...route,
        rps: Math.min(route.rps, downstreamReturnedByKey.get(route.key) ?? 0),
      }))
      .filter((route) => route.rps > 0);
  }

  for (const edge of edges) {
    if (!edgeMetrics[edge.id]) {
      continue;
    }
    edgeMetrics[edge.id].returnRps = edgeReturnRps[edge.id] ?? 0;
  }

  const clientIngress = clients.reduce((sum, client) => sum + client.sourceRps, 0);
  const successfulReturnRps = clients.reduce(
    (sum, client) =>
      sum +
      (returnedRoutesByNode[client.id] ?? []).reduce(
        (routeSum, route) => routeSum + route.rps,
        0,
      ),
    0,
  );
  const availability = clamp(
    successfulReturnRps / Math.max(clientIngress, 1),
    0,
    1,
  );
  const throughput = successfulReturnRps;
  const activeServerMetrics = serverMetrics.filter((metric) => metric.incomingRps > 0);
  const latencySamples = activeServerMetrics.length > 0 ? activeServerMetrics : serverMetrics;
  const latencyLoad = latencySamples.reduce(
    (sum, metric) => sum + Math.max(metric.incomingRps, 1),
    0,
  );
  const latency =
    latencySamples.reduce(
      (sum, metric) => sum + metric.latency * Math.max(metric.incomingRps, 1),
      0,
    ) / Math.max(latencyLoad, 1);
  const stressedComponents = serverMetrics.filter(
    (metric) => metric.status !== "healthy",
  ).length;
  const queueDepth = serverMetrics.reduce(
    (sum, metric) => sum + metric.queueDepth,
    0,
  );
  const cacheMetrics = serverMetrics.filter((metric) => metric.cacheHitRate > 0);
  const cacheHitRate =
    cacheMetrics.reduce((sum, metric) => sum + metric.cacheHitRate, 0) /
    Math.max(cacheMetrics.length, 1);

  const hotSpots = serverMetrics
    .filter((metric) => metric.status !== "healthy" || metric.overloadRatio > 0.85)
    .sort((left, right) => {
      const leftScore = left.cpu + left.errorRate * 100 + left.overloadRatio * 20;
      const rightScore = right.cpu + right.errorRate * 100 + right.overloadRatio * 20;
      return rightScore - leftScore;
    })
    .slice(0, 4)
    .map((metric) => ({
      id: metric.id,
      label: nodesById[metric.id]?.label ?? metric.id,
    }));

  return {
    nodeMetrics,
    edgeMetrics,
    nodeRoutes,
    edgeReturnRoutes,
    system: {
      availability,
      latency,
      throughput,
      stressedComponents,
      queueDepth,
      cacheHitRate,
    },
    hotSpots,
  };
}
