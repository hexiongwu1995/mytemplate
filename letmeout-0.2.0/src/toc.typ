// The sidebar table of contents. Only `letmeout` calls this, and only for HTML,
// so print output is untouched. Headings are read from the finished page by the
// script, which also assigns ids to headings that have none.
#import "toc-css.typ": toc-css
#import "toc-js.typ": toc-js, toc-js-part-two

#let toc-markup(title: "Contents") = {
  html.elem("nav", attrs: (
    class: "letmeout-toc", id: "letmeout-toc",
    "data-state": "open", "aria-label": title,
  ), {
    html.elem("div", attrs: (class: "letmeout-toc-head"), {
      html.elem("p", attrs: (class: "letmeout-toc-title"), title)
      html.elem("button", attrs: (
        class: "letmeout-toc-toggle letmeout-toc-close", type: "button",
        "aria-controls": "letmeout-toc", "aria-expanded": "true",
        "aria-label": "Close navigation", title: "Close navigation",
      ), "✕")
    })
    html.elem("ol", attrs: (class: "letmeout-toc-list", id: "letmeout-toc-list"))
  })
  // A block wrapper keeps Typst from wrapping the button in a paragraph, which
  // would put it out of reach of the sibling selectors below.
  html.elem("div", attrs: (class: "letmeout-toc-opener"), {
    html.elem("button", attrs: (
      class: "letmeout-toc-toggle letmeout-toc-open", type: "button",
      "aria-controls": "letmeout-toc", "aria-expanded": "false",
      "aria-label": "Open navigation", title: "Open navigation",
    ), "☰")
  })
  html.elem("div", attrs: (class: "letmeout-toc-backdrop", "aria-hidden": "true"))
  html.elem("div", attrs: (class: "letmeout-toc-grip", "aria-hidden": "true"))
  html.elem("script", toc-js + toc-js-part-two)
}

// `toc` accepts `true`, `false`, or a dictionary with a `title`.
#let toc-enabled(value) = value != false and value != none
#let toc-title(value) = if type(value) == dictionary { value.at("title", default: "Contents") } else { "Contents" }
