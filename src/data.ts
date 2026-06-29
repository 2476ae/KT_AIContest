import sampleCsv from "../data/sample_transactions.csv?raw";
import { parseTransactionsCsv } from "./services/csv";

export function loadSampleTransactions() {
  return parseTransactionsCsv(sampleCsv);
}
