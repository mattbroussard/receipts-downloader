import _ from "lodash";
import { OAuth2Client, authorizeAsync } from "./google_auth";
import inquirer from "inquirer";
import {
  ALL_IMPORTERS,
  Importer,
  ImporterMessage,
  ImporterResult,
} from "./importers/importer";
import { google, gmail_v1 } from "googleapis";
import mkdirp from "mkdirp";
import { promises as fs } from "fs";
import path from "path";
import { generatePdf } from "./pdf";

inquirer.registerPrompt("datetime", require("inquirer-datepicker-prompt"));

function startOfCurrentMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  return date;
}

type ArtifactType = "json" | "html" | "pdf" | "txt";

interface Config {
  outDir: string;
  importers: string[];
  startDate: Date;
  endDate: Date;
  artifactTypes: ArtifactType[];
}

export interface SummaryEntry {
  messageId: string;
  importerName: string;
  metadata: ImporterResult;
  files: { [T in ArtifactType]?: string };

  // These are not programmatically populated, but can be manually added for consumption by
  // the `collate` script
  exclude?: boolean;
}

export interface SingleMessageJsonFile extends SummaryEntry {
  importerMessageObj: Omit<ImporterMessage, "rawMessage">;
  gmailApiMessageObj: gmail_v1.Schema$Message;
}

function b64decode(
  encoded: string | null | undefined
): string | null | undefined {
  return encoded != null
    ? Buffer.from(encoded, "base64").toString("utf8")
    : encoded;
}

async function askForConfig() {
  const importerNames = _.map(ALL_IMPORTERS, "name");
  const configAnswers = await inquirer.prompt<Config>([
    {
      type: "input",
      name: "outDir",
      default: "out",
      message: "Output directory:",
    },
    {
      type: "datetime",
      name: "startDate",
      message: "Start Date:",
      initial: startOfCurrentMonth(),
    },
    {
      type: "datetime",
      name: "endDate",
      message: "End Date:",
      initial: new Date(),
    },
    {
      type: "checkbox",
      name: "importers",
      choices: importerNames,
      default: importerNames,
      message: "Which importers should run?",
    },
    {
      type: "checkbox",
      name: "artifactTypes",
      choices: ["json", "html", "pdf", "txt"],
      default: ["pdf"],
      message: "Output Types:",
    },
  ]);

  return configAnswers;
}

function findMessagePart(
  message: { payload?: gmail_v1.Schema$MessagePart }, // gmail_v1.Schema$Message,
  mimeType: string
): gmail_v1.Schema$MessagePart | undefined {
  const payload = message.payload;
  if (!payload) {
    return;
  }

  if (payload.mimeType === mimeType) {
    return payload;
  }

  // Some messages only have one top-level MessagePart and no children; this also serves as a base
  // case for the recursion below when we hit a leaf
  if (!payload.parts) {
    return;
  }

  for (const part of payload.parts) {
    const foundPart = findMessagePart({ payload: part }, mimeType);
    if (foundPart) {
      return foundPart;
    }
  }
}

function buildImporterMessage(
  message: gmail_v1.Schema$Message
): ImporterMessage {
  const plainPart = findMessagePart(message, "text/plain");
  const text = b64decode(plainPart?.body?.data!) || undefined;

  // Assumption: Every email these days has an HTML part, but not every email sends a plaintext part
  const htmlPart = findMessagePart(message, "text/html");
  const html = b64decode(htmlPart?.body?.data!)!;

  const headers = message.payload!.headers;
  const subject =
    _.find(headers, (header) => header.name === "Subject")?.value ||
    "(no subject)";

  const date = new Date(Number(message.internalDate));

  return { subject, date, text, html, rawMessage: message };
}

async function runImporter(
  importer: Importer,
  config: Config,
  auth: OAuth2Client
): Promise<SummaryEntry[]> {
  console.log("Running importer:", importer.name);

  const dateSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
  const dateQuery = `after:${dateSeconds(
    config.startDate
  )} before:${dateSeconds(config.endDate)}`;
  const params: gmail_v1.Params$Resource$Users$Messages$List = {
    userId: "me",
    ...importer.params,
    q: `${importer.params.q} ${dateQuery}`,
  };
  console.log("Gmail API message list params:", params);

  // List messages
  const gmail = google.gmail({ version: "v1", auth });
  let messageIds: string[] = [];
  let nextPageToken: string | undefined;
  do {
    if (nextPageToken) {
      console.log("Requesting next page... nextPageToken:", nextPageToken);
    }

    const messageListResp = await gmail.users.messages.list({
      ...params,
      pageToken: nextPageToken,
    });
    const newMessageIds = _.map(
      messageListResp.data.messages || [],
      (m) => m.id!
    );
    console.log("Listed", newMessageIds.length, "messages.");

    messageIds = messageIds.concat(newMessageIds);
    nextPageToken = messageListResp.data.nextPageToken || undefined;

    if (params.maxResults === 1) {
      console.log("Breaking loop after 1 message for test purposes");
      break;
    }
  } while (nextPageToken);

  console.log("Got", messageIds.length, "total messages.");

  // Download each message
  const messageRespPromises = messageIds.map(async (id, idx) => {
    const resp = await gmail.users.messages.get({ id: id!, userId: "me" });
    console.log(
      "Downloaded message with id",
      id,
      `(${idx + 1} of ${messageIds.length})`
    );
    return resp;
  });
  const messageResps = await Promise.all(messageRespPromises);
  const messages = _.map(messageResps, "data");

  // Process each message for metadata extraction
  const summary: SummaryEntry[] = [];
  let extractIdx = 0;
  for (const message of messages) {
    const summaryEntry = await runImporterOnMessage(message, importer, config);
    if (summaryEntry) {
      summary.push(summaryEntry);
    }

    console.log(
      "Done processing message",
      extractIdx + 1,
      "of",
      messages.length
    );
    extractIdx++;
  }

  console.log("Done running importer", importer.name);
  return summary;
}

function getArtifactFilenames(
  metadata: ImporterResult,
  config: Config
): SummaryEntry["files"] {
  return _.fromPairs(
    config.artifactTypes.map((ext) => [ext, `${metadata.filename}.${ext}`])
  );
}

async function runImporterOnMessage(
  message: gmail_v1.Schema$Message,
  importer: Importer,
  config: Config
): Promise<SummaryEntry | undefined> {
  const importerMessage = buildImporterMessage(message);
  const metadata = importer.extractMetadataFromMessage(importerMessage);
  if (!metadata) {
    console.log(
      "Skipping message",
      message.id,
      "because importer returned null"
    );
    return;
  }

  console.log(
    "Imported metadata",
    metadata.filename,
    "from message",
    message.id
  );

  const summaryEntry: SummaryEntry = {
    importerName: importer.name,
    metadata,
    messageId: message.id!,
    files: getArtifactFilenames(metadata, config),
  };

  if (!importerMessage.text) {
    delete summaryEntry.files["txt"];
  }

  if (summaryEntry.files.json) {
    const json: SingleMessageJsonFile = {
      ...summaryEntry,
      importerMessageObj: _.omit(importerMessage, "rawMessage"),
      gmailApiMessageObj: message,
    };

    const fname = path.join(config.outDir, summaryEntry.files.json);
    await fs.writeFile(fname, JSON.stringify(json, undefined, 2));
  }

  if (summaryEntry.files.html) {
    const fname = path.join(config.outDir, summaryEntry.files.html);
    await fs.writeFile(fname, importerMessage.html);
  }

  if (summaryEntry.files.txt && importerMessage.text) {
    const fname = path.join(config.outDir, summaryEntry.files.txt);
    await fs.writeFile(fname, importerMessage.text);
  }

  if (summaryEntry.files.pdf) {
    const fname = path.join(config.outDir, summaryEntry.files.pdf);
    console.log("Generating PDF", fname);

    const transformFn =
      importer.transformHTMLForPDF || ((msg: ImporterMessage) => msg.html);
    const htmlForPdf = transformFn(importerMessage);

    await generatePdf(htmlForPdf, fname);
  }

  return summaryEntry;
}

async function main() {
  const config = await askForConfig();

  console.log("Authenticating with Gmail API...");
  const auth = await authorizeAsync();

  const importersToRun = ALL_IMPORTERS.filter((importer) =>
    _.includes(config.importers, importer.name)
  );

  await mkdirp(config.outDir);

  // TODO: paralellize?
  let summary: SummaryEntry[] = [];
  for (const importer of importersToRun) {
    const importerSummary = await runImporter(importer, config, auth);
    summary = summary.concat(importerSummary);
  }

  console.log("Writing summary JSON file...");
  const summaryFilename = path.join(config.outDir, "download_summary.json");
  await fs.writeFile(summaryFilename, JSON.stringify(summary, undefined, 2));

  console.log("Done, exiting.");
}

if (require.main === module) {
  main();
}
