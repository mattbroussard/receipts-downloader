import type { Importer, ImporterMessage, ImporterResult } from "./importer";
import { formatDateForFilename } from "../util";

export class CaviarImporter implements Importer {
  name = "caviar";
  displayName = "Caviar";
  params = {
    q:
      "from:(support@trycaviar.com) " +
      'subject:("Your Caviar order from" OR "Your Caviar pickup order from")',
  };

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null {
    if (!message.text) {
      return null;
    }

    // These emails don't contain anything useful, and there is a separate receipt email that does.
    if (message.subject.indexOf("ready for pickup") != -1) {
      return null;
    }

    // Get total amount
    const totalMatches = /Total Charged \$([0-9.]+)/g.exec(message.text);
    if (!totalMatches) {
      return null;
    }
    const amt = totalMatches[1];

    // Get vendor name
    const vendorMatches = /Your Caviar (?:pickup )?order from (.*$)/.exec(
      message.subject
    );
    const vendorName = vendorMatches ? vendorMatches[1].trim() : "unknown";

    // Get delivery address
    const addrMatches = /Delivery Address\s*\n([^\n]+)\n/gm.exec(message.text);
    const deliveryAddress =
      message.subject.indexOf("pickup order") != -1
        ? "(pickup order)"
        : addrMatches
        ? addrMatches[1].trim()
        : "unknown";

    // Get date; receipt usually shortly after ordering on same date, so we can use the email timestamp.
    const date = message.date;

    return {
      filename: `caviar_${formatDateForFilename(date)}_${message.rawMessage
        .id!}`,
      date,
      amt,
      deliveryAddress,
      vendorName,
    };
  }
}
