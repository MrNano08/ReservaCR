export type Role = "CLIENT" | "BUSINESS" | "ADMIN";
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
}
export interface Category {
  id: string;
  name: string;
  active: boolean;
}
export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number | null;
  active: boolean;
  businessId: string;
}
export interface Hour {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}
export interface Block {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
}
export interface Business {
  id: string;
  name: string;
  description: string;
  province: string;
  canton: string;
  address: string;
  phone: string;
  categoryId: string;
  category: Category;
  imageUrl: string;
  capacity: number;
  cancellationMinutes: number;
  status: string;
  published: boolean;
  reviewNote: string;
  services: Service[];
  hours: Hour[];
  blocks: Block[];
}
export interface Booking {
  id: string;
  code: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: string;
  price: number | null;
  notes: string;
  cancellationReason: string;
  business: {
    id: string;
    name: string;
    address: string;
    phone: string;
    cancellationMinutes: number;
  };
  client?: { name: string; email: string; phone: string };
}
