export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Revisit {
  id: string;
  userId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  visitDate: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
}
