export type InvoiceStatus =
  | "Waiting"
  | "PartiallyPaid"
  | "Paid"
  | "OverPaid"
  | "UnpaidExpired"
  | "PartiallyPaidExpired"
  | "AdminCanceled"
  | "CustomerCanceled";

export interface InvoiceCartItem {
  name: string;
  quantity: number;
  price: string;
  product_url?: string;
  image_url?: string;
  tax?: string;
  discount?: string;
}

export interface InvoiceCart {
  items: InvoiceCartItem[];
}

export interface Invoice {
  id: string;
  order_id: string;
  asset_id: string;
  asset_name: string;
  chain: string;
  amount: string;
  payment_address: string;
  redirect_url: string;
  status: InvoiceStatus;
  cart: InvoiceCart;
  valid_till: string;
  total_received_amount: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceResponse {
  invoice: Omit<Invoice, "total_received_amount">;
  total_received_amount: string;
}

export function isActiveStatus(s: InvoiceStatus): boolean {
  return s === "Waiting" || s === "PartiallyPaid";
}

export function isFinalStatus(s: InvoiceStatus): boolean {
  return s === "Paid" || s === "OverPaid";
}

export function isExpiredStatus(s: InvoiceStatus): boolean {
  return s === "UnpaidExpired" || s === "PartiallyPaidExpired";
}

export function isCanceledStatus(s: InvoiceStatus): boolean {
  return s === "AdminCanceled" || s === "CustomerCanceled";
}
