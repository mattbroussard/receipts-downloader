# Receipts Downloader

A collection of scripts for downloading receipts from Gmail and combining them into bulk PDFs for submission for reimbursement. Initially, this focuses on food delivery services since that's my immediate use case, but it could be easily extended to other things.

## Getting Started (Downloading Receipts)

1. Clone the repo
2. `npm install`
3. Click the `Enable the Gmail API` button [here](https://developers.google.com/gmail/api/quickstart/nodejs#step_1_turn_on_the) to create a Google Cloud Platform project and get an API key. Download the resulting `credentials.json` file and place it in the repo (don't worry, it's `.gitignore`'d).
4. `npm run download`

   - The first run will provide instructions on how to get an initial OAuth token, after which it is stored in another file, `token.json` and you won't have to do that again.

5. Follow interactive prompts

![image](https://user-images.githubusercontent.com/3347176/109277614-6b2bd300-77cc-11eb-855a-be1751119d10.png)

## Getting Started (Collating Receipts)

There is also a script to collate multiple receipt PDFs into one giant PDF with a cover page showing a total for all of them. Below assumes you have already done the above.

1. Look over `download_summary.json` and the downloaded receipts. Any that you don't want to be included, you can add a field `exclude: true` in the JSON file.
2. `npm run collate`
3. Follow interactive prompts to select the directory where `download_summary.json` and previously downloaded PDFs are.
