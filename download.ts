import _ from "lodash";
import { OAuth2Client, authorizeAsync } from "./google_auth";
import inquirer from "inquirer";
import { ALL_IMPORTERS } from "./importers/importer";

async function main() {
  console.log("Authorizing...");
  const auth = await authorizeAsync();

  const importerNames = _.map(ALL_IMPORTERS, "name");
  const wantedImporters = await inquirer.prompt([]);

  console.log(wantedImporters);
}

if (require.main === module) {
  main();
}
