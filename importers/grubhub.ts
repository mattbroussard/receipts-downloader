import _ from "lodash";
import type { Importer, ImporterMessage, ImporterResult } from "./importer";
import { formatDateForFilename } from "../util";
import { JSDOM } from "jsdom";

export class GrubhubImporter implements Importer {
  name = "grubhub";
  params = {
    q: 'from:(orders@eat.grubhub.com) subject:("Your order from")',
  };

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null {
    // Scheduled orders send 2 emails that both have the receipt info in them; we don't want to
    // double count.
    if (message.subject.indexOf("has been scheduled") != -1) {
      return null;
    }

    const frag = JSDOM.fragment(message.html);
    const cells = Array.from(
      frag.querySelectorAll<HTMLElement>("td#cellMainContent > table")
    ).filter((el) => Boolean(collapseWhitespace(el.textContent)));

    // Extract order amount
    const chargeCell = _.find(
      cells,
      (cell) =>
        collapseWhitespace(cell.textContent)?.indexOf("Total charge") != -1
    );
    const chargeCellText = collapseWhitespace(chargeCell?.textContent) ?? "";
    const chargeMatches = /\$([0-9.]+)/.exec(chargeCellText);
    if (!chargeMatches) {
      return null;
    }
    const amt = chargeMatches[1];

    // Extract order type and vendor name
    const topCell = _.find(
      cells,
      (cell) =>
        collapseWhitespace(cell.textContent)?.indexOf("is being prepared") != -1
    );
    const topCellText = collapseWhitespace(topCell?.textContent) ?? "";
    const topCellMatches = /Your (pickup|delivery) order from (.*) is being prepared/.exec(
      topCellText
    );
    const orderType = topCellMatches?.[1];
    const vendorName = topCellMatches?.[2] || "unknown";

    // Extract delivery address
    const deliveryCellPrevIndex = _.findIndex(
      cells,
      (cell) =>
        collapseWhitespace(cell.textContent)?.indexOf(
          "Contact restaurant for delivery issues"
        ) != -1
    );
    const deliveryCellText =
      collapseWhitespace(
        deliveryCellPrevIndex >= 0
          ? cells[deliveryCellPrevIndex + 1]?.textContent
          : ""
      ) ?? "";
    // This regex... Yuck!
    const deliveryMatches = /Delivery \([^\)]+\)[^,]+, (.*)\([0-9]{3}\)/.exec(
      deliveryCellText
    );
    const deliveryAddress =
      orderType == "pickup"
        ? "(pickup order)"
        : deliveryMatches
        ? deliveryMatches[1].trim()
        : "unknown";

    // Get date; receipt usually shortly after ordering on same date, so we can use the email timestamp.
    const date = message.date;

    return {
      filename: `grubhub_${formatDateForFilename(date)}_${message.rawMessage
        .id!}`,
      date,
      amt,
      deliveryAddress,
      vendorName,
    };
  }
}

// GrubHub text has extra spaces for some reason (probably missing template variables on their side)
// and these mess up our regexes where they expect single-spaced sentences. This replaces contiguous
// ranges of spaces with a single space.
function collapseWhitespace<S extends string | null | undefined>(
  str: S
): string | S {
  if (str === undefined || str === null) {
    return str;
  }
  return str.replace(/ +/g, " ");
}
