import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedChunkCallback {
  (chunk: any[], totalProcessed: number): Promise<void>;
}

/**
 * Fast inspection of approximate row count without parsing all data into memory
 */
export async function inspectFileRowCount(file: File): Promise<{
  estimatedRows: number;
  fileType: "csv" | "xlsx";
}> {
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
  
  if (isXlsx) {
    // Read XLSX workbook metadata
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", sheetRows: 50 }); // small preview first
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const ref = sheet["!ref"];
    let estimatedRows = 0;
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      estimatedRows = range.e.r; // total rows in sheet range
    }
    return { estimatedRows: Math.max(estimatedRows, 1), fileType: "xlsx" };
  }

  // For CSV: estimate based on sample byte size vs total file size
  const sampleSize = Math.min(file.size, 1024 * 512); // 512 KB sample
  const sampleSlice = file.slice(0, sampleSize);
  const text = await sampleSlice.text();
  const sampleLines = text.split(/\r?\n/).filter(l => l.trim().length > 0).length;

  if (sampleSize >= file.size) {
    return { estimatedRows: Math.max(sampleLines - 1, 0), fileType: "csv" };
  }

  const avgBytesPerLine = sampleSize / Math.max(sampleLines, 1);
  const estimatedRows = Math.round(file.size / avgBytesPerLine);
  return { estimatedRows: Math.max(estimatedRows, 1), fileType: "csv" };
}

/**
 * Stream parse CSV file in chunks of `chunkSize`
 */
export function streamParseCsv(
  file: File,
  chunkSize: number = 3000,
  onChunk: (rows: any[], progressPercent: number) => Promise<void>,
  onComplete: () => void,
  onError: (err: Error) => void
) {
  let buffer: any[] = [];
  let totalProcessed = 0;
  const fileSize = file.size;
  let bytesRead = 0;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    chunkSize: 1024 * 1024 * 2, // 2MB read chunks
    chunk: async (results, parser) => {
      parser.pause();
      try {
        const rows = results.data as any[];
        buffer.push(...rows);

        bytesRead += (results.meta as any)?.cursor || 0;
        const pct = fileSize > 0 ? Math.min(Math.round((bytesRead / fileSize) * 100), 99) : 50;

        while (buffer.length >= chunkSize) {
          const toSend = buffer.splice(0, chunkSize);
          totalProcessed += toSend.length;
          await onChunk(toSend, pct);
        }

        parser.resume();
      } catch (err: any) {
        parser.abort();
        onError(err);
      }
    },
    complete: async () => {
      try {
        if (buffer.length > 0) {
          totalProcessed += buffer.length;
          await onChunk(buffer, 100);
          buffer = [];
        }
        onComplete();
      } catch (err: any) {
        onError(err);
      }
    },
    error: (err) => {
      onError(new Error(err.message));
    }
  });
}

/**
 * Parse XLSX file in chunks
 */
export async function streamParseXlsx(
  file: File,
  chunkSize: number = 3000,
  onChunk: (rows: any[], progressPercent: number) => Promise<void>,
  onComplete: () => void,
  onError: (err: Error) => void
) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const totalRows = rawRows.length;
    for (let i = 0; i < totalRows; i += chunkSize) {
      const slice = rawRows.slice(i, i + chunkSize);
      const pct = Math.round(((i + slice.length) / totalRows) * 100);
      await onChunk(slice, pct);
    }
    onComplete();
  } catch (err: any) {
    onError(err);
  }
}
