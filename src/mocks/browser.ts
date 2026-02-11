import { setupWorker } from "msw/browser";
import { handlers } from "./handlers/index.ts";

export const worker = setupWorker(...handlers);
