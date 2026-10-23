import JSZip from "jszip";
import { SaxesParser } from "saxes";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const escapeText = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeAttr = (s: string) => escapeText(s).replaceAll('"', "&quot;").replaceAll("\r", "&#13;").replaceAll("\n", "&#10;").replaceAll("\t", "&#9;");

// ExcelJS matches literal XML names, so valid <x:workbook> documents fail.
// Resolve names by namespace URI, never by blindly replacing prefixes in text.
export function normalizeSpreadsheetXml(xml: string): string {
  const parser = new SaxesParser({xmlns:true});
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  let changed = false, root = true;
  const elementName = (tag: {uri:string;local:string;name:string}) => {
    if (tag.uri === MAIN || tag.uri === RELS) {
      if (tag.name !== tag.local) changed = true;
      return tag.local;
    }
    return tag.name;
  };
  parser.on("doctype", () => { throw new Error("Workbook XML with a document type declaration is not supported."); });
  parser.on("opentag", tag => {
    const name = elementName(tag);
    const attrs = Object.values(tag.attributes).filter(a => !(root && ["xmlns", "xmlns:r"].includes(a.name)));
    const attributes = attrs.map(a => {
      const key = a.uri === DOC_RELS ? `r:${a.local}` : a.name;
      if (key !== a.name) changed = true;
      return ` ${key}="${escapeAttr(a.value)}"`;
    });
    if (root) {
      const defaultNamespace = tag.uri === MAIN || tag.uri === RELS ? tag.uri : tag.ns[""];
      if (defaultNamespace) attributes.push(` xmlns="${escapeAttr(defaultNamespace)}"`);
      attributes.push(` xmlns:r="${DOC_RELS}"`);
      root = false;
    }
    out.push(`<${name}${attributes.join("")}>`);
  });
  parser.on("closetag", tag => out.push(`</${elementName(tag)}>`));
  parser.on("text", text => out.push(escapeText(text)));
  parser.on("cdata", text => out.push(escapeText(text)));
  parser.write(xml).close();
  return changed ? out.join("") : xml;
}

export async function normalizeWorkbookNamespaces(bytes: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(bytes);
  let expanded = 0, changed = false;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.(xml|rels)$/i.test(entry.name)) continue;
    const xmlBytes = await entry.async("nodebuffer");
    expanded += xmlBytes.length;
    if (expanded > 20 * 1024 * 1024) throw new Error("The expanded workbook exceeds 20 MB.");
    const xml = xmlBytes.toString("utf8");
    const normalized = normalizeSpreadsheetXml(xml);
    if (normalized !== xml) { zip.file(entry.name,normalized); changed = true; }
  }
  return changed ? zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}) : bytes;
}
