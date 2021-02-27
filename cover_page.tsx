import _ from "lodash";
import type { SummaryEntry } from "./download";
import React from "react";
import { ALL_IMPORTERS } from "./importers/importer";
import moment from "moment";

interface CoverPageProps {
  entries: SummaryEntry[];
  css: string;
}

export const CoverPage: React.FunctionComponent<CoverPageProps> = ({
  entries,
  css,
}) => {
  return (
    <html>
      <head>
        <title>Expenses</title>
        <style type="text/css" dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="root">
          <div className="preface">
            This file contains receipts for multiple transactions of the same
            category. This cover page contains a summary of the transactions,
            followed by all individual receipts on subsequent pages.
          </div>
          <EntriesTable entries={entries} />
        </div>
      </body>
    </html>
  );
};

interface EntriesTableProps {
  entries: SummaryEntry[];
}

const EntriesTable: React.FunctionComponent<EntriesTableProps> = ({
  entries,
}) => {
  const total = _.sumBy(entries, (entry) => Number(entry.metadata.amt)).toFixed(
    2
  );

  return (
    <table className="entries-table">
      <thead></thead>
      <tbody>
        {entries.map((entry) => (
          <EntryRow entry={entry} key={entry.messageId} />
        ))}
        <tr className="total-row">
          <td colSpan={2}>Total:</td>
          <td>${total}</td>
        </tr>
      </tbody>
    </table>
  );
};

interface EntryRowProps {
  entry: SummaryEntry;
}

const EntryRow: React.FunctionComponent<EntryRowProps> = ({ entry }) => {
  const importer = _.find(
    ALL_IMPORTERS,
    (importer) => importer.name === entry.importerName
  );
  const importerDisplayName = importer?.displayName ?? "Unknown";

  return (
    <tr className="entry-row">
      <td>{moment(entry.metadata.date).format("MMMM D, YYYY")}</td>
      <td>
        {importerDisplayName}{" "}
        {entry.metadata.vendorName && (
          <span className="vendor-name">({entry.metadata.vendorName})</span>
        )}
      </td>
      <td>${entry.metadata.amt}</td>
    </tr>
  );
};
