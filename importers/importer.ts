import type { gmail_v1 } from "googleapis";
import { DummyImporter } from "./dummy_importer";
import { DoordashImporter } from "./doordash";

export interface ImporterMessage {
  html: string;
  text?: string;
  subject: string;
  date: Date;
  rawMessage: gmail_v1.Schema$Message;
}

export interface ImporterResult {
  // A filename for artifacts related to this message. Should exclude extension, since multiple
  // files (json, html, pdf) may be emitted.
  filename: string;

  date: Date;
  amt: string;

  deliveryAddress?: string;
  vendorName?: string;
}

export interface Importer {
  readonly name: string;
  readonly params: gmail_v1.Params$Resource$Users$Messages$List;

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null;
}

export const ALL_IMPORTERS: Importer[] = [
  new DummyImporter(),
  new DoordashImporter(),
];
