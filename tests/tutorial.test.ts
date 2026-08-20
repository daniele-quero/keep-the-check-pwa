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

  it("'it' map exposes only the supported option keys", () => {
    const tips = getOptionTooltips("it");
    expect(tips["Currency"]).toBeDefined();
    expect(tips["Require Manual Confirm"]).toBeDefined();
    expect(tips["Use Coupons"]).toBeDefined();
    expect(tips["Value"]).toBeDefined();
    expect(tips["Threshold"]).toBeDefined();
    expect(tips["Import"]).toBeDefined();
    expect(tips["AI Image Model"]).toBeUndefined();
    expect(tips["AI Image Endpoint"]).toBeUndefined();
    expect(tips["AI Image Key"]).toBeUndefined();
    expect(tips["Use Image Proxy"]).toBeUndefined();
  });

  it("'en' map exposes only the supported option keys", () => {
    const tips = getOptionTooltips("en");
    expect(tips["Currency"]).toBeDefined();
    expect(tips["Require Manual Confirm"]).toBeDefined();
    expect(tips["Use Coupons"]).toBeDefined();
    expect(tips["Value"]).toBeDefined();
    expect(tips["Threshold"]).toBeDefined();
    expect(tips["Import"]).toBeDefined();
    expect(tips["AI Image Model"]).toBeUndefined();
    expect(tips["AI Image Endpoint"]).toBeUndefined();
    expect(tips["AI Image Key"]).toBeUndefined();
    expect(tips["Use Image Proxy"]).toBeUndefined();
  });

  it("does not expose legacy tooltip keys in 'it'", () => {
    const tips = getOptionTooltips("it");
    expect(tips["OCR Engine"]).toBeUndefined();
    expect(tips["OCR Key"]).toBeUndefined();
    expect(tips["Use OCR"]).toBeUndefined();
    expect(tips["isTable"]).toBeUndefined();
    expect(tips["AI Client"]).toBeUndefined();
    expect(tips["AI Key"]).toBeUndefined();
    expect(tips["AI Image Model"]).toBeUndefined();
    expect(tips["AI Image Endpoint"]).toBeUndefined();
  });

  it("does not expose legacy tooltip keys in 'en'", () => {
    const tips = getOptionTooltips("en");
    expect(tips["OCR Engine"]).toBeUndefined();
    expect(tips["OCR Key"]).toBeUndefined();
    expect(tips["Use OCR"]).toBeUndefined();
    expect(tips["isTable"]).toBeUndefined();
    expect(tips["AI Client"]).toBeUndefined();
    expect(tips["AI Key"]).toBeUndefined();
    expect(tips["AI Image Model"]).toBeUndefined();
    expect(tips["AI Image Endpoint"]).toBeUndefined();
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

  it("Italian tutorial keeps the privacy disclaimer without AI configuration details", () => {
    const html = renderTutorial("it").toLowerCase();
    expect(html).toContain("privacy");
    expect(html).toContain("proxy sicuro");
    expect(html).not.toContain("configurazione server-side ia");
    expect(html).not.toContain("ai_gateway_vision_key");
    expect(html).not.toContain("auto:vision");
    expect(html).not.toContain("gateway");
  });

  it("English tutorial keeps the privacy disclaimer without AI configuration details", () => {
    const html = renderTutorial("en").toLowerCase();
    expect(html).toContain("privacy");
    expect(html).toContain("secure proxy");
    expect(html).not.toContain("server-side ai configuration");
    expect(html).not.toContain("ai_gateway_vision_key");
    expect(html).not.toContain("auto:vision");
    expect(html).not.toContain("gateway");
  });

  it("Italian tutorial describes the current compact AI review modal", () => {
    const html = renderTutorial("it").toLowerCase();
    expect(html).toContain("tipo");
    expect(html).toContain("confidence");
    expect(html).toContain("quantità");
    expect(html).toContain("proxy sicuro");
    expect(html).not.toContain("configurato nelle opzioni");
    expect(html).not.toContain("con un solo click");
  });

  it("English tutorial describes the current compact AI review modal", () => {
    const html = renderTutorial("en").toLowerCase();
    expect(html).toContain("type");
    expect(html).toContain("confidence");
    expect(html).toContain("quantity");
    expect(html).toContain("secure proxy");
    expect(html).not.toContain("configured in options");
    expect(html).not.toContain("with one click");
  });

  it("does not expose AI configuration instructions in option tooltips", () => {
    expect(getOptionTooltips("it")["AI Analysis"]).toBeUndefined();
    expect(getOptionTooltips("en")["AI Analysis"]).toBeUndefined();
  });
});
