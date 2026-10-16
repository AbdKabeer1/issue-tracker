import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "./rich-text";

const render = (content: string) =>
  renderToStaticMarkup(createElement(RichText, { content }));

describe("RichText shows tag-like text (#116)", () => {
  it("keeps <Button> and List<String> in plain text", () => {
    const html = render("The <Button> component crashes when List<String> is empty.");
    expect(html).toContain("The &lt;Button&gt; component crashes when List&lt;String&gt; is empty.");
  });

  it("keeps tags inside inline code and fenced code", () => {
    const html = render("Crash when `List<String>` is empty\n\n```tsx\n<Provider store={store}>\n```");
    expect(html).toContain("<code>List&lt;String&gt;</code>");
    expect(html).toContain("&lt;Provider store={store}&gt;");
  });

  it("escapes markup instead of rendering it", () => {
    const html = render('**x** <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("RichText ordered list start attribute (#137)", () => {
  it('renders <ol start="3"> when list starts at 3', () => {
    const html = render("3. third step\n4. fourth step");
    expect(html).toContain('<ol start="3">');
    expect(html).toContain("third step");
    expect(html).toContain("fourth step");
  });

  it("renders standard ordered list when starting at 1", () => {
    const html = render("1. first step\n2. second step");
    expect(html).toContain("<ol");
    expect(html).toContain("first step");
  });
});

