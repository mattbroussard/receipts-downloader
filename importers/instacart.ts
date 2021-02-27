import _ from "lodash";
import type { Importer, ImporterMessage, ImporterResult } from "./importer";
import { formatDateForFilename } from "../util";
import { JSDOM } from "jsdom";

export class InstacartImporter implements Importer {
  name = "instacart";
  params = {
    q: "from:(orders@instacart.com) subject:receipt",
  };

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null {
    const frag = JSDOM.fragment(message.html);

    // Get date; receipt usually shortly after delivery on same date, so we can use the email timestamp.
    const date = message.date;

    // Get amount
    const chargeTypeCells = Array.from(
      frag.querySelectorAll<HTMLElement>("td.charge-type")
    );
    const totalChargeTypeCell = _.find(
      chargeTypeCells,
      (td) => td.textContent?.indexOf("Total Charged") != -1
    );
    const amt = totalChargeTypeCell?.parentElement
      ?.querySelector("td.amount")
      ?.textContent?.trim();
    if (!amt) {
      return null;
    }

    // Get vendor name
    const deliveryCells = Array.from(
      frag.querySelectorAll<HTMLElement>("div.DriverDeliverySchedule")
    );
    const deliveryText = deliveryCells
      .map((td) => td.textContent ?? "")
      .join("\n\n");
    const vendorMatches = /Your order from (.*) was placed/.exec(deliveryText);
    const vendorName = vendorMatches?.[1] ?? "unknown";

    return {
      filename: `instacart_${formatDateForFilename(date)}_${message.rawMessage
        .id!}`,
      date,
      amt,
      vendorName,
    };
  }
}
