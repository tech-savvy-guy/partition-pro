import type { CSSProperties } from "react";

export type ExcelCell = {
  value: string | number | boolean | null | undefined;
  style?: CSSProperties;
  header?: boolean;
};

type ExportExcelTableOptions = {
  filename: string;
  sheetName?: string;
  rows: ExcelCell[][];
};

type ZipEntry = {
  path: string;
  content: string;
};

type CellStyle = {
  fill: string;
  color: string;
  bold: boolean;
  align: string;
};

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const DEFAULT_STYLE: CellStyle = {
  fill: "",
  color: "",
  bold: false,
  align: "",
};

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

function normalizeFilename(filename: string) {
  return filename.replace(/\.(csv|xls|xlsx)$/i, "") + ".xlsx";
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) return "";

  const hex = match[1];
  const rgb =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;

  return `FF${rgb.toUpperCase()}`;
}

function normalizeFontWeight(value: unknown) {
  if (value === "bold") return true;
  if (typeof value === "number") return value >= 600;
  if (typeof value === "string") return Number(value) >= 600;
  return false;
}

function normalizeTextAlign(value: unknown) {
  if (value === "center" || value === "right" || value === "left") {
    return value;
  }
  return "";
}

function getCellStyle(cell: ExcelCell): CellStyle {
  const style = cell.style ?? {};

  return {
    fill:
      normalizeHexColor(style.backgroundColor) ||
      (cell.header ? "FFF3F4F6" : ""),
    color:
      normalizeHexColor(style.color) ||
      (cell.header ? "FF111827" : ""),
    bold: Boolean(cell.header) || normalizeFontWeight(style.fontWeight),
    align:
      normalizeTextAlign(style.textAlign) || (cell.header ? "center" : ""),
  };
}

function styleKey(style: CellStyle) {
  return JSON.stringify(style);
}

function buildStyleIndex(rows: ExcelCell[][]) {
  const styles = [DEFAULT_STYLE];
  const indexByKey = new Map<string, number>([[styleKey(DEFAULT_STYLE), 0]]);

  rows.forEach((row) => {
    row.forEach((cell) => {
      const style = getCellStyle(cell);
      const key = styleKey(style);
      if (!indexByKey.has(key)) {
        indexByKey.set(key, styles.length);
        styles.push(style);
      }
    });
  });

  return { styles, indexByKey };
}

function columnName(index: number) {
  let n = index + 1;
  let name = "";

  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
}

function buildStylesXml(styles: CellStyle[]) {
  const fillMap = new Map<string, number>([
    ["", 0],
    ["gray125", 1],
  ]);

  const fontMap = new Map<string, number>([[styleKey(DEFAULT_STYLE), 0]]);
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  const fonts = [
    '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
  ];

  styles.forEach((style) => {
    if (style.fill && !fillMap.has(style.fill)) {
      fillMap.set(style.fill, fills.length);
      fills.push(
        `<fill><patternFill patternType="solid"><fgColor rgb="${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`,
      );
    }

    const fontKey = JSON.stringify({ color: style.color, bold: style.bold });
    if (!fontMap.has(fontKey)) {
      fontMap.set(fontKey, fonts.length);
      fonts.push(
        `<font>${style.bold ? "<b/>" : ""}<sz val="11"/>${
          style.color ? `<color rgb="${style.color}"/>` : '<color theme="1"/>'
        }<name val="Calibri"/><family val="2"/></font>`,
      );
    }
  });

  const cellXfs = styles
    .map((style) => {
      const fontKey = JSON.stringify({ color: style.color, bold: style.bold });
      const fontId = fontMap.get(fontKey) ?? 0;
      const fillId = fillMap.get(style.fill) ?? 0;
      const alignment = style.align
        ? `<alignment horizontal="${style.align}" vertical="center" wrapText="1"/>`
        : "";

      return `<xf numFmtId="49" fontId="${fontId}" fillId="${fillId}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${
        style.align ? ' applyAlignment="1"' : ""
      }>${alignment}</xf>`;
    })
    .join("");

  return `${XML_DECLARATION}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="${fonts.length}">${fonts.join("")}</fonts>
  <fills count="${fills.length}">${fills.join("")}</fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${styles.length}">${cellXfs}</cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function buildWorksheetXml(
  rows: ExcelCell[][],
  styleIndexByKey: Map<string, number>,
) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columns =
    maxColumns > 0
      ? `<cols>${Array.from({ length: maxColumns }, (_, index) => {
          const width = index === 0 ? 24 : 16;
          return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        }).join("")}</cols>`
      : "";

  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const styleId = styleIndexByKey.get(styleKey(getCellStyle(cell))) ?? 0;
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;

          return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(
            cell.value,
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `${XML_DECLARATION}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${columns}
  <sheetData>${sheetData}</sheetData>
</worksheet>`;
}

function buildWorkbookXml(sheetName: string) {
  return `${XML_DECLARATION}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function buildWorkbookRelsXml() {
  return `${XML_DECLARATION}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildRootRelsXml() {
  return `${XML_DECLARATION}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildContentTypesXml() {
  return `${XML_DECLARATION}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(out: number[], value: number) {
  out.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function appendBytes(out: number[], bytes: ArrayLike<number>) {
  for (let i = 0; i < bytes.length; i += 1) {
    out.push(bytes[i]);
  }
}

function createZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const out: number[] = [];
  const central: number[] = [];

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.path);
    const contentBytes = encoder.encode(entry.content);
    const crc = crc32(contentBytes);
    const localOffset = out.length;

    writeUint32(out, 0x04034b50);
    writeUint16(out, 20);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint32(out, crc);
    writeUint32(out, contentBytes.length);
    writeUint32(out, contentBytes.length);
    writeUint16(out, nameBytes.length);
    writeUint16(out, 0);
    appendBytes(out, nameBytes);
    appendBytes(out, contentBytes);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, crc);
    writeUint32(central, contentBytes.length);
    writeUint32(central, contentBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, localOffset);
    appendBytes(central, nameBytes);
  });

  const centralOffset = out.length;
  appendBytes(out, central);

  writeUint32(out, 0x06054b50);
  writeUint16(out, 0);
  writeUint16(out, 0);
  writeUint16(out, entries.length);
  writeUint16(out, entries.length);
  writeUint32(out, central.length);
  writeUint32(out, centralOffset);
  writeUint16(out, 0);

  return new Uint8Array(out);
}

export function exportExcelTable({
  filename,
  sheetName = "Sheet1",
  rows,
}: ExportExcelTableOptions) {
  const worksheetName = sanitizeSheetName(sheetName);
  const { styles, indexByKey } = buildStyleIndex(rows);

  const zipBytes = createZip([
    { path: "[Content_Types].xml", content: buildContentTypesXml() },
    { path: "_rels/.rels", content: buildRootRelsXml() },
    { path: "xl/workbook.xml", content: buildWorkbookXml(worksheetName) },
    { path: "xl/_rels/workbook.xml.rels", content: buildWorkbookRelsXml() },
    { path: "xl/styles.xml", content: buildStylesXml(styles) },
    {
      path: "xl/worksheets/sheet1.xml",
      content: buildWorksheetXml(rows, indexByKey),
    },
  ]);

  const blob = new Blob([zipBytes], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = normalizeFilename(filename);
  a.click();

  URL.revokeObjectURL(url);
}