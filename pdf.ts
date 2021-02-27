import pdf from "html-pdf";

export async function generatePdf(
  html: string,
  outFile: string,
  options: pdf.CreateOptions = {}
) {
  return new Promise<pdf.FileInfo>((resolve, reject) =>
    pdf
      .create(html, {
        // TODO: figure out something better here
        // This looks ok, but is a weird non-standard PDF size
        // Can't figure out how to configure DPI, which seems to default 72 (but might be device dependent)
        // https://github.com/ariya/phantomjs/issues/12685
        width: "1000px",
        height: "1300px",
        ...options,
      })
      .toFile(outFile, (err, res) => {
        if (!err) {
          resolve(res);
        } else {
          reject(err);
        }
      })
  );
}
