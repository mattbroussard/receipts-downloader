import { authorizeAsync } from "./google_auth";

(async () => {
  const auth = await authorizeAsync();
  console.log("auth success", auth);
})();
