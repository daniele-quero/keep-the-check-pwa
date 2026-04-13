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

  it("renders anchor tags for link items", () => {
    const html = renderTutorial("it");
    expect(html).toContain("<a href=");
    expect(html).toContain("target=\"_blank\"");
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

  it("'it' map contains known key 'AI Client'", () => {
    const tips = getOptionTooltips("it");
    expect(tips["AI Client"]).toBeDefined();
  });

  it("'en' map contains known key 'AI Client'", () => {
    const tips = getOptionTooltips("en");
    expect(tips["AI Client"]).toBeDefined();
  });

  it("key 'Import' strips parenthesised suffix", () => {
    const tips = getOptionTooltips("en");
    expect(tips["Import"]).toBeDefined();
    expect(tips["Import (📁)"]).toBeUndefined();
  });
});
