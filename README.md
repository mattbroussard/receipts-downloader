# Receipts Downloader

A collection of scripts for downloading receipts from Gmail and combining them into bulk PDFs for submission for reimbursement. Initially, this focuses on food delivery services since that's my immediate use case, but it could be easily extended to other things.

# Getting Started

1. Clone the repo
2. `npm install`
3. Click the `Enable the Gmail API` button here to create a Google Cloud Platform project and get an API key. Download the resulting `credentials.json` file and place it in the repo (don't worry, it's `.gitignore`'d).
4. `npm run download`

    - The first run will provide instructions on how to get an initial OAuth token, after which it is stored in another file, `token.json` and you won't have to do that again.

5. Follow interactive prompts

![image](https://user-images.githubusercontent.com/3347176/109277614-6b2bd300-77cc-11eb-855a-be1751119d10.png)
