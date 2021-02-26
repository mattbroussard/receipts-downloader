import type { Importer, ImporterMessage } from "./importer";

export class DummyImporter implements Importer {
  name = "dummy";
  params = {
    q: 'from:(no-reply@doordash.com) subject:("Order Confirmation")',
    maxResults: 1,
  };

  extractMetadataFromMessage(message: ImporterMessage) {
    return {
      filename: "dummy_importer_1",
      amt: "420.69",
      date: new Date(),
    };
  }
}
