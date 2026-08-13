import type { Locale } from "../config";
import { th } from "./th";
import { en } from "./en";

/** The message shape, inferred from Thai (the source of truth). */
export type Messages = typeof th;

export const messages: Record<Locale, Messages> = { th, en };
