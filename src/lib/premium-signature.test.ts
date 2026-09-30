import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { findLowestTextBaselineY, addDigitalSignature } from "./premium-merge";

async function makeBodyPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Body line near top.", {
    x: 50,
    y: 700,
    size: 11,
    font,
    color: rgb(0.06, 0.09, 0.16),
  });
  const bytes = await doc.save();
  return new File([Uint8Array.from(bytes)], "body.pdf", {
    type: "application/pdf",
  });
}

describe("findLowestTextBaselineY", () => {
  it("finds body baseline", async () => {
    const file = await makeBodyPdf();
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const page = doc.getPages()[0];
    const y = findLowestTextBaselineY(page, 792);
    assert.ok(y != null);
    assert.ok(Math.abs(y! - 700) < 1);
  });
});

describe("addDigitalSignature", () => {
  it("places plain lines under content without stamp chrome", async () => {
    const file = await makeBodyPdf();
    const blob = await addDigitalSignature(file, {
      signerName: "Pat Tanmay",
      reason: "Approved",
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    assert.equal(doc.getPageCount(), 1);
    const page = doc.getPages()[0];
    const y = findLowestTextBaselineY(page, 792);
    // Signature lines sit below 700; lowest baseline should be well above page bottom
    assert.ok(y != null && y! > 600 && y! < 700);
    // Inspect page content only (whole-file binary can false-match color triples)
    const { PDFArray, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
    const contents = page.node.Contents();
    const refs: unknown[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) refs.push(contents.get(i));
    } else if (contents) refs.push(contents);
    let stream = "";
    for (const ref of refs) {
      const looked = page.doc.context.lookup(ref as never);
      if (!(looked instanceof PDFRawStream)) continue;
      stream += Buffer.from(decodePDFRawStream(looked).decode()).toString(
        "latin1"
      );
    }
    const ascii = stream.replace(/<([0-9A-Fa-f]+)>/g, (_, h) =>
      Buffer.from(h, "hex").toString("latin1")
    );
    assert.equal(/Digitally signed/.test(ascii), false);
    assert.match(ascii, /Signed:/);
    assert.equal(/HelveticaOblique/.test(stream), false);
  });
});
