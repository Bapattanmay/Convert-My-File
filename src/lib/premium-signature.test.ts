import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  findLowestTextBaselineY,
  addDigitalSignature,
} from "./premium-merge";

async function makePdfWithLines(
  lines: { text: string; y: number }[],
  name = "doc.pdf"
) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  for (const line of lines) {
    page.drawText(line.text, {
      x: 50,
      y: line.y,
      size: 11,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }
  const bytes = await doc.save();
  return new File([Uint8Array.from(bytes)], name, {
    type: "application/pdf",
  });
}

describe("findLowestTextBaselineY", () => {
  it("finds body baseline", async () => {
    const file = await makePdfWithLines([{ text: "Body line near top.", y: 700 }]);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const y = findLowestTextBaselineY(doc.getPages()[0], 792);
    assert.ok(y != null);
    assert.ok(Math.abs(y! - 700) < 1);
  });

  it("ignores isolated footer far below body", async () => {
    const file = await makePdfWithLines([
      { text: "Salary line 1", y: 720 },
      { text: "Salary line 2", y: 700 },
      { text: "Salary line 3", y: 680 },
      { text: "Page 1", y: 40 },
    ]);
    const doc = await PDFDocument.load(await file.arrayBuffer());
    const y = findLowestTextBaselineY(doc.getPages()[0], 792);
    assert.ok(y != null);
    assert.ok(Math.abs(y! - 680) < 1, `expected ~680 got ${y}`);
  });
});

describe("addDigitalSignature", () => {
  it("stays on 1 page under salary-like body (no blank page 2)", async () => {
    const file = await makePdfWithLines(
      [
        { text: "Salary Slip — March 2026", y: 720 },
        { text: "Employee: Tanmay Bapat", y: 700 },
        { text: "Basic: 50,000", y: 680 },
        { text: "HRA: 20,000", y: 660 },
        { text: "Net Pay: 62,000", y: 640 },
        { text: "Page 1", y: 36 },
      ],
      "salary.pdf"
    );
    const blob = await addDigitalSignature(file, {
      signerName: "Tanmay Bapat",
      reason: "Approved",
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    assert.equal(doc.getPageCount(), 1, "must not add a blank signature page");
    const y = findLowestTextBaselineY(doc.getPages()[0], 792);
    // Signature under salary body (~640), still well above page bottom
    assert.ok(y != null && y! < 640 && y! > 560, `sig cluster low=${y}`);
  });

  it("places plain lines without stamp chrome", async () => {
    const file = await makePdfWithLines([{ text: "Body line near top.", y: 700 }]);
    const blob = await addDigitalSignature(file, {
      signerName: "Pat Tanmay",
      reason: "Approved",
    });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    assert.equal(doc.getPageCount(), 1);
    const page = doc.getPages()[0];
    const { PDFArray, PDFRawStream, decodePDFRawStream } = await import(
      "pdf-lib"
    );
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
