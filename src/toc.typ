// The sidebar table of contents. Only `mytemplate` calls this, and only for HTML,
// so print output is untouched. Headings are read from the finished page by the
// script, which also assigns ids to headings that have none.
#import "toc-css.typ": toc-css
#import "toc-js.typ": toc-js, toc-js-part-two

#let toc-markup(title: "Contents") = {
  html.elem("nav", attrs: (
    class: "mytemplate-toc", id: "mytemplate-toc",
    "data-state": "open", "aria-label": title,
  ), {
    html.elem("div", attrs: (class: "mytemplate-toc-head"), {
      html.elem("p", attrs: (class: "mytemplate-toc-title"), title)
      html.elem("button", attrs: (
        class: "mytemplate-toc-toggle mytemplate-toc-close", type: "button",
        "aria-controls": "mytemplate-toc", "aria-expanded": "true",
        "aria-label": "Close navigation", title: "Close navigation",
      ), "✕")
    })
    html.elem("ol", attrs: (class: "mytemplate-toc-list", id: "mytemplate-toc-list"))
    html.elem("div", attrs: (
      class: "mytemplate-toc-resize", "aria-hidden": "true",
      title: "Drag to resize navigation",
    ), {
      html.elem("span", attrs: (class: "mytemplate-toc-resize-grip", "aria-hidden": "true"))
    })
  })
  // A block wrapper keeps Typst from wrapping the button in a paragraph, which
  // would put it out of reach of the sibling selectors below.
  html.elem("div", attrs: (class: "mytemplate-toc-opener"), {
    html.elem("button", attrs: (
      class: "mytemplate-toc-toggle mytemplate-toc-open", type: "button",
      "aria-controls": "mytemplate-toc", "aria-expanded": "false",
      "aria-label": "Open navigation", title: "Open navigation",
    ), "☰")
  })
  html.elem("div", attrs: (class: "mytemplate-toc-backdrop", "aria-hidden": "true"))
  html.elem("div", attrs: (class: "mytemplate-toc-grip", "aria-hidden": "true"))
  html.elem("script", toc-js + toc-js-part-two)
}

// `toc` accepts `true`, `false`, or a dictionary with a `title`.
#let toc-enabled(value) = value != false and value != none
#let toc-title(value) = if type(value) == dictionary { value.at("title", default: "Contents") } else { "Contents" }
