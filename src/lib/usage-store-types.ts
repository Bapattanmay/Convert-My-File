export type LocationInfo = {
  source: "browser_geolocation" | "ip_approximate" | "unknown";
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
};

export type Visitor = {
  id: string;
  googleSub?: string;
  email?: string;
  name: string;
  picture?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalTimeSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
  userAgent?: string;
};

export type AnalyticsSession = {
  id: string;
  visitorId: string;
  startedAt: string;
  endedAt?: string | null;
  lastHeartbeatAt: string;
  timeSpentSeconds: number;
  featuresUsed: string[];
  location: LocationInfo;
};

export type FeatureEvent = {
  id: string;
  visitorId: string;
  sessionId: string;
  feature: string;
  at: string;
};

export type AdminAudit = {
  id: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  at: string;
};

export type AnalyticsStore = {
  visitors: Visitor[];
  sessions: AnalyticsSession[];
  featureEvents: FeatureEvent[];
  adminAudit: AdminAudit[];
};
