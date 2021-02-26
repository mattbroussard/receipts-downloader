import moment from "moment";

export function formatDateForFilename(date: Date): string {
  return moment(date).format("MMDDYYYY_HHmmss");
}
