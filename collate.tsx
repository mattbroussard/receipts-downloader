import _ from "lodash";
import inquirer from "inquirer";
import { ALL_IMPORTERS } from "./importers/importer";
import { promises as fs } from "fs";
import path from "path";
import type { SummaryEntry } from "./download";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { generatePdf } from "./pdf";
import { CoverPage } from "./cover_page";
import PDFMerger from "pdf-merger-js";

interface Config {
  inDir: string;
  outFile: string;
  importers: string[];
}

async function askForConfig() {
  const importerNames = _.map(ALL_IMPORTERS, "name");
  const outTypes = ["json", "html", "pdf", "txt"];
  const configAnswers = await inquirer.prompt<Config>([
    {
      type: "input",
      name: "inDir",
      default: "out",
      message: "Download script's output directory:",
    },
    {
      type: "input",
      name: "outFile",
      default: "receipts.pdf",
      message: "Combined output filename (in above dir):",
    },
    {
      type: "checkbox",
      name: "importers",
      choices: importerNames,
      default: importerNames,
      message: "Restrict which importers' entries are included?",
    },
  ]);

  return configAnswers;
}

async function main() {
  const config = await askForConfig();

  // Load summary file
  const summaryPath = path.join(config.inDir, "download_summary.json");
  console.log("Loading", summaryPath, "...");
  const summaryStr = await fs.readFile(summaryPath, { encoding: "utf8" });
  const summary: SummaryEntry[] = JSON.parse(summaryStr);

  // Filter and sort
  const entries = _.sortBy(
    summary.filter(
      (entry) =>
        !entry.exclude &&
        config.importers.includes(entry.importerName) &&
        entry.files.pdf
    ),
    (entry) => new Date(entry.metadata.date)
  );

  // Render cover page
  console.log("Generating cover page PDF...");
  const css = await fs.readFile(path.join(__dirname, "cover_page.css"), {
    encoding: "utf8",
  });
  const coverHtml = ReactDOMServer.renderToStaticMarkup(
    <CoverPage entries={entries} css={css} />
  );
  const coverPath = path.join(config.inDir, "cover_page_tmp.pdf");
  await generatePdf(coverHtml, coverPath);

  // Concat pages together
  const pdfFiles = [
    coverPath,
    ...entries.map((entry) => path.join(config.inDir, entry.files.pdf!)),
  ];
  const outPath = path.join(config.inDir, config.outFile);
  console.log(
    "Concatenating",
    pdfFiles.length,
    "PDFs together into",
    outPath,
    "..."
  );
  const merger = new PDFMerger();
  pdfFiles.forEach((file) => merger.add(file));
  await merger.save(outPath);

  console.log("Done, exiting.");
}

if (require.main === module) {
  main();
}
