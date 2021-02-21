import _ from "lodash";
import { OAuth2Client, authorizeAsync } from "./google_auth";
import inquirer from "inquirer";
import { ALL_IMPORTERS, Importer } from "./importers/importer";
import { google, gmail_v1 } from "googleapis";

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
    maxResults: 100,
  };
  console.log("Gmail API message list params:", params);

  const gmail = google.gmail({ version: "v1", auth });
  const messagesResp = await gmail.users.messages.list(params);
  const messages = messagesResp.data.messages;

  // TODO: implement rest
  console.log(messages);
}

async function main() {
  const config = await askForConfig();

  console.log("Authenticating with Gmail API...");
  const auth = await authorizeAsync();

  const importersToRun = ALL_IMPORTERS.filter((importer) =>
    _.includes(config.importers, importer.name)
  );

  // TODO: paralellize?
  for (const importer of importersToRun) {
    await runImporter(importer, config, auth);
  }
}

if (require.main === module) {
  main();
}
