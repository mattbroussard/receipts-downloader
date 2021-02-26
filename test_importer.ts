import _ from "lodash";
import { promises as fs } from "fs";
import type { SingleMessageJsonFile } from "./download";
import { ALL_IMPORTERS } from "./importers/importer";

async function main() {
  // When run in ts-node, there is an extra element at the beginning of argv
  if (process.argv.length < 4) {
    console.log("Usage: test_importer [importer_name] [json_filename]");
    return;
  }
  const [, , importerName, jsonFilename] = process.argv;

  const jsonStr = await fs.readFile(jsonFilename, { encoding: "utf8" });
  const json: SingleMessageJsonFile = JSON.parse(jsonStr);

  const importer = _.find(
    ALL_IMPORTERS,
    (importer) => importer.name == importerName
  );
  if (!importer) {
    throw new Error("invalid importer name");
  }

  const importerMessage = {
    ...json.importerMessageObj,
    rawMessage: json.gmailApiMessageObj,
  };
  const result = importer.extractMetadataFromMessage(importerMessage);

  console.log(result);
}

if (require.main === module) {
  main();
}
