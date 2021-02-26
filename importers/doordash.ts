import type { Importer, ImporterMessage, ImporterResult } from "./importer";
import { formatDateForFilename } from "../util";

export class DoordashImporter implements Importer {
  name = "doordash";
  params = {
    q: 'from:(no-reply@doordash.com) subject:("Order Confirmation")',
  };

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null {
    if (!message.text) {
      return null;
    }

    // Get total amount
    const totalMatches = /Total Charged \$([0-9.]+)/g.exec(message.text);
    if (!totalMatches) {
      return null;
    }
    const amt = totalMatches[1];

    // Get vendor name
    const vendorMatches = /Order Confirmation for .* from (.*$)/.exec(
      message.subject
    );
    const vendorName = vendorMatches ? vendorMatches[1].trim() : "unknown";

    // Get delivery address
    // TODO: handle pickup
    const addrMatches = /Your receipt\s*\n([^\n]+)\n/gm.exec(message.text);
    const deliveryAddress = addrMatches ? addrMatches[1].trim() : "unknown";

    // Get date; receipt usually shortly after ordering on same date, so we can use the email timestamp.
    const date = message.date;

    return {
      filename: `doordash_${formatDateForFilename(date)}_${message.rawMessage
        .id!}`,
      date,
      amt,
      deliveryAddress,
      vendorName,
    };
  }
}
