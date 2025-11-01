import { ElementConfig } from '../../layouts/types/element-config';

export interface TableAvailability {
  elementId: string;
  status: 'available' | 'held' | 'reserved' | 'blocked';
  holdExpiresAt?: string | null;
  reservationId?: string | null;
}

export interface TablePricing {
  elementId: string;
  currency: string;
  amount: number;
  fees?: number;
}

export interface TableMapMetadata {
  totalTables: number;
  availableTables: number;
  availableSeats: number;
  venueWaitlist: number;
  userWaitlistCount: number;
}

export interface TableMapResponse {
  layoutId: string;
  eventId: string;
  version: number;
  elements: ElementConfig[];
  availability: TableAvailability[];
  pricing: TablePricing[];
  metadata: TableMapMetadata;
}
