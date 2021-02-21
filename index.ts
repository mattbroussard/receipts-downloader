import { authorizeAsync } from "./google_auth";
import { google, gmail_v1 } from "googleapis";
import _ from "lodash";

function getHtml(message: gmail_v1.Schema$Message): string {
  const parts = message.payload!.parts;
  const htmlPart = _.find(parts, (part) => part.mimeType == "text/html");
  const b64body = htmlPart!.body!.data!;
  const html = Buffer.from(b64body, "base64").toString("utf8");
  return html;
}

(async () => {
  const auth = await authorizeAsync();

  const gmail = google.gmail({ version: "v1", auth });
  const messagesResp = await gmail.users.messages.list({
    userId: "me",
    q: 'from:(no-reply@doordash.com) subject:("Order Confirmation")',
    maxResults: 5,
  });

  const indivMessageRespPromises = messagesResp.data.messages!.map((message) =>
    gmail.users.messages.get({ userId: "me", id: message.id! })
  );

  const messages = (await Promise.all(indivMessageRespPromises)).map(
    (resp) => resp.data
  );

  console.log(messages);
  // console.log(JSON.stringify(messages[0], undefined, 2));
  console.log(getHtml(messages[0]));
})();
