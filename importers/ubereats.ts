import _ from "lodash";
import type { Importer, ImporterMessage, ImporterResult } from "./importer";
import { formatDateForFilename } from "../util";
import { JSDOM } from "jsdom";

export class UberEatsImporter implements Importer {
  name = "ubereats";
  params = {
    // Require "Delivery person tip" because Uber sends separate emails for the main order, and the
    // tip which charges separately. They are otherwise the same subject and template, so we only
    // want to process the one with the tip so we don't double-count.
    //
    // This does assume every order will have a tip, so if you don't always tip, you may need to
    // adjust this.
    q: 'from:("Uber Receipts") subject:order "Delivery person tip" -refund',
  };

  extractMetadataFromMessage(message: ImporterMessage): ImporterResult | null {
    const frag = JSDOM.fragment(message.html);

    // Extract total
    const amtCell = frag.querySelector<HTMLElement>("td.total_head:last-child");
    const amtMatches = /\$([0-9.]+)/.exec(amtCell?.textContent ?? "");
    if (!amtMatches) {
      return null;
    }
    const amt = amtMatches[1];

    // Extract delivery address
    // TODO: support pickup
    const blackCells = Array.from(
      frag.querySelectorAll<HTMLElement>("td.Uber18_text_p2.black")
    );
    const deliveredToCell = _.find(
      blackCells,
      (td) => td.textContent?.indexOf("Delivered to") != -1
    );
    const deliveryAddress =
      deliveredToCell?.parentElement?.parentElement
        ?.querySelector("tr:last-child > td")
        ?.textContent?.trim() ?? "unknown";

    // Extract vendor name
    const cellTexts = Array.from(frag.querySelectorAll("td.Uber18_text_p1"))
      .map((td) => td.textContent)
      .filter((val): val is string => Boolean(val));
    const vendorCellText =
      _.find(
        cellTexts,
        (str) =>
          str.indexOf(
            // Note: this is case-sensitive. In Feb 2021 there is a promo text at the top of
            // some emails that says "If you ordered from a local restaurant...". Sigh.
            "You ordered from"
          ) != -1
      ) ?? "";
    const vendorMatches = /You ordered from (.*)/.exec(vendorCellText);
    const vendorName = vendorMatches?.[1] ?? "unknown";

    // Get date; receipt usually shortly after ordering on same date, so we can use the email timestamp.
    const date = message.date;

    return {
      filename: `ubereats_${formatDateForFilename(date)}_${message.rawMessage
        .id!}`,
      date,
      amt,
      deliveryAddress,
      vendorName,
    };
  }
}
