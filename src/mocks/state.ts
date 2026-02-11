export type Scenario = "happy" | "expired" | "partial";

export interface MockState {
  invoiceStatus: string;
  paymentSubmittedAt: number | null;
  firstRequestAt: number | null;
}

const defaultState: MockState = {
  invoiceStatus: "Waiting",
  paymentSubmittedAt: null,
  firstRequestAt: null,
};

export const mockState: MockState = { ...defaultState };

export function resetMockState(): void {
  Object.assign(mockState, defaultState);
}

export function getScenarioFromUrl(): Scenario {
  const params = new URLSearchParams(globalThis.location.search);
  return (params.get("scenario") as Scenario) || "happy";
}

export function getPollDelay(): number {
  const params = new URLSearchParams(globalThis.location.search);
  return parseInt(params.get("pollDelay") || "12000", 10);
}

export function getInvoiceAmount(): string {
  const params = new URLSearchParams(globalThis.location.search);
  return params.get("invoiceAmount") || "100.00";
}
