# mytemplate

**Write your document once in Typst. Get a PDF for print and a real web page
for the screen.**

Typst's HTML export is still young: grids, lines, page headers, shapes, colored
boxes, spacing, and columns are dropped or flattened, so the web version never
looks like your PDF. mytemplate fills that gap. Import it, add one line, and your
layouts become clean, responsive HTML and CSS. The text stays selectable, links
work, and the page adapts to phones and dark mode. Your PDF stays byte for byte
the same.

```typ
#import "@preview/mytemplate:0.3.0": *
#show: mytemplate

#show: page.with(paper: "a5", header: grid(columns: (1fr, auto), [Report], [2026]))

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  rect(fill: aqua.lighten(60%), radius: 4pt)[A colored card],
  rect(stroke: (dash: "dashed"))[Another one],
)
#line(length: 100%, stroke: (paint: blue, dash: "dashed"))
#align(center)[Centered text]
```

```sh
typst compile --features html --format html report.typ report.html
typst compile report.typ report.pdf
```

## Why mytemplate

- **Your layout survives.** `grid`, `line`, and `align` become CSS Grid and
  vector strokes. Shapes, styled boxes and blocks, spacing, padding, transforms,
  stacks, columns, and placement come along too.
- **Pages make sense on a screen.** Page settings become one continuous,
  centred sheet: the width caps the line length, margins shrink on small
  screens, wide equations, code, and layouts scroll sideways, headers and
  footers render once, and page breaks only apply when the reader prints.
- **Made for reading.** No pictures of text: everything is selectable,
  searchable HTML with native MathML. Text size, weight, style, font families,
  and colors carry over. The page follows the reader's light or dark mode.
- **Nothing changes in print.** PDF, PNG, and SVG use Typst's own elements.
  The test suite checks that they are identical byte for byte.
- **A table of contents that fits the screen.** Every HTML page gets a sidebar
  outline built from its headings. It starts open on wide screens and closed on
  phones, toggles with a button for mouse users, follows the finger when swiped
  on a touch screen, and can be widened or narrowed by dragging the handle on
  its edge. Turn it off with `#show: mytemplate.with(toc: false)`.
- **Same Typst you know.** Keep calling `grid`, `page.with(...)`, and
  `pagebreak()`. Where HTML should differ from print, say so with
  `mytemplate-extras.html-only(...)` and `mytemplate-extras.paged-only(...)`.
- **No runtime.** No external stylesheet and no build step beyond
  `typst compile`. The sidebar is the only script: a small inline script for its
  button, resize handle, and swipe gestures, which `toc: false` removes.

## Getting started

Requires Typst 0.15 or newer.

1. Import the package: `#import "@preview/mytemplate:0.3.0": *`.
2. Put `#show: mytemplate` at the top of the document, before anything else, to
   bring pages, shapes, spacing, fonts, colors, and dark mode to HTML.
   Native `grid.cell`, `set grid`, `set line`, and `set align` remain available.
3. Use `mytemplate-extras` for target-specific settings, color schemes, and
   documented native aliases:

```typ
#import "@preview/mytemplate:0.3.0": *
#show: mytemplate
#show: page.with(paper: "a4", margin: 2.5cm)
#show: mytemplate-extras.html-only(page.with(width: auto, margin: 1em))
```

The PDF keeps its A4 page; the web page fills the screen with a small margin.

The HTML sidebar reads the headings automatically, so no extra markup is
needed. On a wide screen it is open and the page makes room for it; on a narrow
screen it slides over the page and starts closed. Mouse and trackpad users get
a button, touch screens swipe it open and shut with a live drag. Set
`#show: mytemplate.with(toc: (title: "目录"))` to rename it, or `toc: false` to
leave it out.

Run the examples from a repository checkout:

```sh
typst compile --root . --features html docs/grid.typ docs/grid.html
typst compile --root . --features html docs/features.typ docs/features.html
typst compile --root . --features html docs/page.typ docs/page.html
```

## Documentation

- [Reference](docs/reference.md): how each part of a document becomes HTML,
  pages, target-specific settings, dark mode, and native element APIs.
- [HTML field reference](docs/html-semantics.md): every parameter and field in
  detail.
- Editor hover docs: `mytemplate`, `mytemplate-extras.grid`, `mytemplate-extras.line`,
  `mytemplate-extras.align`, and `mytemplate-extras.page` note what each parameter does in HTML.
- [Contributing](CONTRIBUTING.md): tests, generated docs, and releases.
- [Bun guide](BUN.md): installing Bun and the commands used by the test suite.

## Origin

`mytemplate` originates from the `letmeout` package:
<https://typst.app/universe/package/letmeout>.

## License

MIT
