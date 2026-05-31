import { describe, it, expect } from "vitest";
import { renderTutorial, getOptionTooltips, translations } from "../src/tutorial";
import type { Lang } from "../src/tutorial";

describe("renderTutorial", () => {
  it("renders non-empty HTML for 'it'", () => {
    const html = renderTutorial("it");
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("<div class=\"tutorial-section\">");
  });

  it("renders non-empty HTML for 'en'", () => {
    const html = renderTutorial("en");
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("<div class=\"tutorial-section\">");
  });

  it("renders correct number of sections for 'it'", () => {
    const html = renderTutorial("it");
    const count = (html.match(/<div class="tutorial-section">/g) ?? []).length;
    expect(count).toBe(translations.it.sections.length);
  });

  it("renders h3 titles", () => {
    const html = renderTutorial("it");
    expect(html).toContain("<h3>");
  });

  it("renders ordered list for ordered sections", () => {
    const html = renderTutorial("it");
    expect(html).toContain("<ol>");
    expect(html).toContain("</ol>");
  });

  it("renders unordered list for non-ordered sections", () => {
    const html = renderTutorial("it");
    expect(html).toContain("<ul>");
    expect(html).toContain("</ul>");
  });

  it("renders note paragraphs where present", () => {
    const html = renderTutorial("it");
    expect(html).toContain("class=\"tutorial-note\"");
  });

  it("'it' and 'en' produce different HTML", () => {
    expect(renderTutorial("it")).not.toBe(renderTutorial("en"));
  });
});

describe("getOptionTooltips", () => {
  const LANGS: Lang[] = ["it", "en"];

  for (const lang of LANGS) {
    it(`returns a non-empty map for lang '${lang}'`, () => {
      const tips = getOptionTooltips(lang);
      expect(Object.keys(tips).length).toBeGreaterThan(0);
    });

    it(`all values are non-empty strings for lang '${lang}'`, () => {
      const tips = getOptionTooltips(lang);
      for (const value of Object.values(tips)) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
    });

    it(`keys do not contain parenthesised suffixes for lang '${lang}'`, () => {
      const tips = getOptionTooltips(lang);
      for (const key of Object.keys(tips)) {
        expect(key).not.toMatch(/\(/);
      }
    });
  }

  it("'it' map contains known key 'Currency'", () => {
    const tips = getOptionTooltips("it");
    expect(tips["Currency"]).toBeDefined();
  });

  it("'en' map contains known key 'Currency'", () => {
    const tips = getOptionTooltips("en");
    expect(tips["Currency"]).toBeDefined();
  });

  it("key 'Import' strips parenthesised suffix", () => {
    const tips = getOptionTooltips("en");
    expect(tips["Import"]).toBeDefined();
    expect(tips["Import (📁)"]).toBeUndefined();
  });

  it("'it' map exposes AI image tooltip keys", () => {
    const tips = getOptionTooltips("it");
    expect(tips["AI Image Endpoint"]).toBeDefined();
    expect(tips["AI Image Model"]).toBeDefined();
    expect(tips["AI Image Key"]).toBeDefined();
    expect(tips["AI Image Timeout"]).toBeDefined();
    expect(tips["Use Image Proxy"]).toBeDefined();
    expect(tips["Require Manual Confirm"]).toBeDefined();
  });

  it("'en' map exposes AI image tooltip keys", () => {
    const tips = getOptionTooltips("en");
    expect(tips["AI Image Endpoint"]).toBeDefined();
    expect(tips["AI Image Model"]).toBeDefined();
    expect(tips["AI Image Key"]).toBeDefined();
    expect(tips["AI Image Timeout"]).toBeDefined();
    expect(tips["Use Image Proxy"]).toBeDefined();
    expect(tips["Require Manual Confirm"]).toBeDefined();
  });

  it("does not expose legacy tooltip keys in 'it'", () => {
    const tips = getOptionTooltips("it");
    expect(tips["OCR Engine"]).toBeUndefined();
    expect(tips["OCR Key"]).toBeUndefined();
    expect(tips["Use OCR"]).toBeUndefined();
    expect(tips["isTable"]).toBeUndefined();
    expect(tips["AI Client"]).toBeUndefined();
    expect(tips["AI Key"]).toBeUndefined();
  });

  it("does not expose legacy tooltip keys in 'en'", () => {
    const tips = getOptionTooltips("en");
    expect(tips["OCR Engine"]).toBeUndefined();
    expect(tips["OCR Key"]).toBeUndefined();
    expect(tips["Use OCR"]).toBeUndefined();
    expect(tips["isTable"]).toBeUndefined();
    expect(tips["AI Client"]).toBeUndefined();
    expect(tips["AI Key"]).toBeUndefined();
  });
});

describe("tutorial content — AI migration", () => {
  it("Italian tutorial mentions IA / intelligenza artificiale", () => {
    const html = renderTutorial("it");
    expect(/\bIA\b|intelligenza artificiale/.test(html)).toBe(true);
  });

  it("English tutorial mentions AI", () => {
    const html = renderTutorial("en");
    expect(/\bAI\b/.test(html)).toBe(true);
  });

  it("Italian tutorial contains no 'OCR' substring (case-insensitive)", () => {
    const html = renderTutorial("it");
    expect(html.toLowerCase()).not.toContain("ocr");
  });

  it("English tutorial contains no 'OCR' substring (case-insensitive)", () => {
    const html = renderTutorial("en");
    expect(html.toLowerCase()).not.toContain("ocr");
  });

  it("raw translation objects contain no 'OCR' substring (case-insensitive)", () => {
    const serialized = JSON.stringify(translations).toLowerCase();
    expect(serialized).not.toContain("ocr");
  });

  it("Italian scan section describes review / confirm flow", () => {
    const scan = translations.it.sections.find((s) => s.title.includes("Scansione"));
    expect(scan).toBeDefined();
    const joined = JSON.stringify(scan).toLowerCase();
    expect(joined).toContain("conferma");
    expect(/rived|modific/.test(joined)).toBe(true);
  });

  it("English scan section describes review / confirm flow", () => {
    const scan = translations.en.sections.find((s) => s.title.includes("Scanning"));
    expect(scan).toBeDefined();
    const joined = JSON.stringify(scan).toLowerCase();
    expect(joined).toContain("confirm");
    expect(/review|edit/.test(joined)).toBe(true);
  });

  it("Italian tutorial mentions manual entry as fallback", () => {
    const html = renderTutorial("it").toLowerCase();
    expect(html).toContain("inserimento manuale");
    expect(html).toContain("fallback");
  });

  it("English tutorial mentions manual entry as fallback", () => {
    const html = renderTutorial("en").toLowerCase();
    expect(html).toContain("manual entry");
    expect(html).toContain("fallback");
  });

  it("Italian tutorial mentions privacy / endpoint configurato", () => {
    const html = renderTutorial("it").toLowerCase();
    expect(html).toContain("privacy");
    expect(html).toContain("endpoint");
  });

  it("English tutorial mentions privacy / configured endpoint", () => {
    const html = renderTutorial("en").toLowerCase();
    expect(html).toContain("privacy");
    expect(html).toContain("endpoint");
  });
});
