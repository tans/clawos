export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface DealInput {
  customerId: number;
  title: string;
  amount?: number;
  stage?: string;
}

export interface InteractionInput {
  customerId: number;
  note: string;
  channel?: string;
}

export interface CustomerRecord {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  createdAt: string;
}

export interface DealRecord {
  id: number;
  customerId: number;
  title: string;
  amount: number;
  stage: string;
  createdAt: string;
}

export interface InteractionRecord {
  id: number;
  customerId: number;
  note: string;
  channel: string;
  createdAt: string;
}
