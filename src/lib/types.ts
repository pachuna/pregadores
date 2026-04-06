export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  role?: string;
}

export interface Revisit {
  id: string;
  userId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  notes: string | null;
  visitDate: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}

export interface PioneerReport {
  id: string;
  userId: string;
  date: string;        // "YYYY-MM-DD"
  hours: number;
  minutes: number;
  creditHours: number;
  bibleStudies: number;
  goalHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
