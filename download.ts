import _ from "lodash";
import { OAuth2Client, authorizeAsync } from "./google_auth";
import inquirer from "inquirer";
import { ALL_IMPORTERS, Importer, ImporterMessage } from "./importers/importer";
import { google, gmail_v1 } from "googleapis";
import mkdirp from "mkdirp";
import { promises as fs } from "fs";
import path from "path";
import pdf from "html-pdf";

inquirer.registerPrompt("datetime", require("inquirer-datepicker-prompt"));

function startOfCurrentMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  return date;
}

interface Config {
  outDir: string;
  importers: string[];
  startDate: Date;
  endDate: Date;
  artifactTypes: ("json" | "html" | "pdf")[];
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
  const outTypes = ["json", "html", "pdf"];
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
      choices: outTypes,
      default: outTypes,
      message: "Output Types:",
    },
  ]);

  return configAnswers;
}

function buildImporterMessage(
  message: gmail_v1.Schema$Message
): ImporterMessage {
  const parts = message.payload!.parts;

  const plainPart = _.find(parts, (part) => part.mimeType === "text/plain");
  const text = b64decode(plainPart?.body?.data!) || undefined;

  const htmlPart = _.find(parts, (part) => part.mimeType === "text/html");
  const html = b64decode(htmlPart?.body?.data!)!;

  const headers = message.payload!.headers;
  const subject =
    _.find(headers, (header) => header.name === "Subject")?.value ||
    "(no subject)";

  const date = new Date(Number(message.internalDate));

  return { rawMessage: message, text, html, subject, date };
}

async function runImporter(
  importer: Importer,
  config: Config,
  auth: OAuth2Client
) {
  console.log("Running importer:", importer.name);

  const dateSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
  const dateQuery = `after:${dateSeconds(
    config.startDate
  )} before:${dateSeconds(config.endDate)}`;
  const params: gmail_v1.Params$Resource$Users$Messages$List = {
    userId: "me",
    ...importer.params,
    q: `${importer.params.q} ${dateQuery}`,

    // TODO: paging
    maxResults: 1,
  };
  console.log("Gmail API message list params:", params);

  // List messages
  const gmail = google.gmail({ version: "v1", auth });
  const messageListResp = await gmail.users.messages.list(params);
  const messageIds = _.map(messageListResp.data.messages || [], "id");
  console.log("Listed", messageIds.length, "messages.");

  // Download each message
  const messageRespPromises = messageIds.map(async (id) => {
    const resp = await gmail.users.messages.get({ id: id!, userId: "me" });
    console.log("Downloaded message with id", id);
    return resp;
  });
  const messageResps = await Promise.all(messageRespPromises);
  const messages = _.map(messageResps, "data");

  // Process each message for metadata extraction
  for (const message of messages) {
    await runImporterOnMessage(message, importer, config);
  }

  console.log("Done running importer", importer.name);
}

async function runImporterOnMessage(
  message: gmail_v1.Schema$Message,
  importer: Importer,
  config: Config
) {
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

  console.log("Imported", metadata.filename, "from message", message.id);

  if (config.artifactTypes.includes("json")) {
    const json = {
      metadata,
      messageId: message.id,
      importerMessageObj: _.omit(importerMessage, "rawMessage"),
      gmailApiMessageObj: message,
    };

    const fname = path.join(config.outDir, metadata.filename + ".json");
    await fs.writeFile(fname, JSON.stringify(json, undefined, 2));
  }

  if (config.artifactTypes.includes("html")) {
    const fname = path.join(config.outDir, metadata.filename + ".html");
    await fs.writeFile(fname, importerMessage.html);
  }

  if (config.artifactTypes.includes("pdf")) {
    const fname = path.join(config.outDir, metadata.filename + ".pdf");
    console.log("Generating PDF", fname);
    await new Promise((resolve) =>
      pdf
        .create(importerMessage.html, {
          // TODO: figure out something better here
          // This looks ok, but is a weird non-standard PDF size
          // Can't figure out how to configure DPI, which seems to default 72 (but might be device dependent)
          // https://github.com/ariya/phantomjs/issues/12685
          width: "1000px",
          height: "1300px",
        })
        .toFile(fname, resolve)
    );
  }
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
  for (const importer of importersToRun) {
    await runImporter(importer, config, auth);
  }
}

if (require.main === module) {
  main();
}
