// The behaviour of the sidebar: build the outline from the headings, toggle it
// with a button for mouse users, and drag it with a finger on touch screens.
// The drag updates `--mytemplate-toc-progress` directly, so the panel and the
// page move with the finger; releasing snaps to the nearer end.
#let toc-js = "(function () {
  var nav = document.querySelector('.mytemplate-toc');
  if (!nav) return;
  var root = document.documentElement;
  var openButton = document.querySelector('.mytemplate-toc-open');
  var closeButton = nav.querySelector('.mytemplate-toc-close');
  var backdrop = document.querySelector('.mytemplate-toc-backdrop');
  var list = nav.querySelector('.mytemplate-toc-list');
  var wide = window.matchMedia('(min-width: 64rem)');
  var coarse = window.matchMedia('(pointer: coarse)');
  var progress = wide.matches ? 1 : 0;
  var chosen = false;
  var links = [];
  var minimum = 6;
  // The outline item the reader followed and the scroll position it settled
  // at. While an item is pinned it stays highlighted, so the highlight matches
  // the jump even when the page ends before the heading can reach the top.
  var pinned = null;
  var pinY = null;
  var pinTimer = 0;

  function apply(value, animate) {
    progress = Math.max(0, Math.min(1, value));
    if (!animate) root.classList.add('mytemplate-toc-dragging');
    root.style.setProperty('--mytemplate-toc-progress', String(progress));
    if (animate) {
      root.classList.remove('mytemplate-toc-dragging');
      var open = progress > 0.5;
      nav.setAttribute('data-state', open ? 'open' : 'closed');
      if ('inert' in nav) nav.inert = !open;
    }
    if (openButton) openButton.setAttribute('aria-expanded', String(progress > 0.5));
    if (closeButton) closeButton.setAttribute('aria-expanded', String(progress > 0.5));
  }

  function toggle(open) {
    chosen = true;
    apply(open ? 1 : 0, true);
  }

  apply(progress, true);

  if (openButton) openButton.addEventListener('click', function () { toggle(true); });
  if (closeButton) closeButton.addEventListener('click', function () { toggle(false); });
  if (backdrop) backdrop.addEventListener('click', function () { toggle(false); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && progress > 0.5) toggle(false);
  });

  wide.addEventListener('change', function () {
    if (!chosen) apply(wide.matches ? 1 : 0, true);
  });

  // Move the highlight to one item and keep it in view.
  function mark(active) {
    var changed = false;
    for (var j = 0; j < links.length; j++) {
      var isActive = links[j] === active;
      if (isActive && links[j].link.getAttribute('aria-current') !== 'location') {
        links[j].link.setAttribute('aria-current', 'location');
        changed = true;
      } else if (!isActive && links[j].link.hasAttribute('aria-current')) {
        links[j].link.removeAttribute('aria-current');
      }
    }
    if (changed && active) {
      var top = active.link.offsetTop;
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 32) {
        list.scrollTop = Math.max(0, top - 32);
      }
    }
  }

  // Keep the followed item highlighted until the reader moves the page. The
  // position is captured once the jump has stopped, so the smooth scroll
  // itself does not count as the reader scrolling away.
  function pin(item) {
    mark(item);
    pinned = item;
    pinY = null;
    window.clearTimeout(pinTimer);
    pinTimer = window.setTimeout(function () { pinY = window.scrollY; }, 200);
  }

  function follow(item) {
    item.link.addEventListener('click', function () {
      if (!wide.matches) toggle(false);
      pin(item);
    });
  }

  function build() {
    if (!list) return;
    var found = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var fragment = document.createDocumentFragment();
    var used = Object.create(null);
    for (var i = 0; i < found.length; i++) {
      var heading = found[i];
      if (nav.contains(heading)) continue;
      var level = parseInt(heading.tagName.substring(1), 10);
      if (level < minimum) minimum = level;
      if (!heading.id) {
        var text = (heading.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        text = text.replace(/^-+/, '').replace(/-+$/, '');
        var id = text || 'section';
        var unique = id;
        var suffix = 2;
        while (used[unique] || document.getElementById(unique)) { unique = id + '-' + suffix; suffix += 1; }
        heading.id = unique;
      }
      used[heading.id] = true;
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'mytemplate-toc-link';
      link.href = '#' + heading.id;
      var plain = (heading.textContent || '').replace(/\s+/g, ' ').trim();
      link.textContent = plain;
      link.style.setProperty('--mytemplate-toc-depth', '0');
      link.setAttribute('data-level', String(level));
      item.appendChild(link);
      fragment.appendChild(item);
      links.push({ link: link, heading: heading });
    }
    list.appendChild(fragment);
    for (var j = 0; j < links.length; j++) {
      var depth = parseInt(links[j].link.getAttribute('data-level'), 10) - minimum;
      links[j].link.style.setProperty('--mytemplate-toc-depth', String(Math.max(0, depth)));
      follow(links[j]);
    }
    if (location.hash) {
      var name = location.hash.substring(1);
      try { name = decodeURIComponent(name); } catch (error) {}
      var target = document.getElementById(name);
      if (target) {
        target.scrollIntoView();
        for (var k = 0; k < links.length; k++) {
          if (links[k].heading === target) { pin(links[k]); break; }
        }
      }
    }
    spy();
  }

  function spy() {
    if (!links.length || pinned) return;
    // Following an outline link leaves the heading at the top edge of the
    // viewport, so the spy has to read from that same edge. A line further
    // down would make a section shorter than the line hand the highlight to
    // the next heading as soon as its link is clicked.
    var line = window.scrollY + 1;
    var active = links[0];
    for (var i = 0; i < links.length; i++) {
      var box = links[i].heading.getBoundingClientRect();
      if (box.top + window.scrollY <= line) active = links[i];
      else break;
    }
    // At the end of the document the last heading may still sit below the
    // reading line; mark it anyway so the outline keeps tracking the reader.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = links[links.length - 1];
    }
    mark(active);
  }
"

#let toc-js-part-two = "
  // A followed item stays highlighted until the jump has settled and the
  // reader then moves the page away from where it landed.
  function track() {
    if (!pinned) return;
    if (pinY === null) {
      window.clearTimeout(pinTimer);
      pinTimer = window.setTimeout(function () { pinY = window.scrollY; }, 200);
      return;
    }
    if (Math.abs(window.scrollY - pinY) > 2) {
      pinned = null;
      pinY = null;
    }
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; track(); spy(); });
  }, { passive: true });
  window.addEventListener('resize', spy);

  // Touch: track one finger, follow it, then snap.
  var startX = null;
  var startY = null;
  var startProgress = 0;
  var dragDirection = 1;
  var width = 1;
  var axis = null;
  var dragging = false;
  var suppressClick = false;

  function reset() {
    startX = null;
    startY = null;
    axis = null;
    startProgress = 0;
  }

  function start(event) {
    if (!coarse.matches || event.touches.length !== 1) return;
    var touch = event.touches[0];
    if (event.target.closest && event.target.closest('.mytemplate-scroll')) return;
    if (progress < 0.5 && event.target.closest && event.target.closest('.mytemplate-toc')) return;
    startX = touch.clientX;
    startY = touch.clientY;
    startProgress = progress;
    // In a right-to-left document the panel lives on the right, so the same
    // finger motion travels the other way.
    dragDirection = window.getComputedStyle(root).direction === 'rtl' ? -1 : 1;
    width = nav.getBoundingClientRect().width || 272;
    axis = null;
    dragging = false;
  }

  function move(event) {
    if (startX === null || event.touches.length !== 1) return;
    var touch = event.touches[0];
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    if (axis === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'y') { reset(); return; }
      dragging = true;
      root.classList.add('mytemplate-toc-dragging');
    }
    if (axis !== 'x') return;
    event.preventDefault();
    var travel = dragDirection * dx;
    apply(startProgress + travel / width, false);
  }

  function end() {
    if (startX === null) return;
    var wasDragging = dragging;
    reset();
    dragging = false;
    root.classList.remove('mytemplate-toc-dragging');
    if (!wasDragging) return;
    suppressClick = true;
    window.setTimeout(function () { suppressClick = false; }, 350);
    chosen = true;
    var open = progress > 0.5;
    apply(open ? 1 : 0, true);
  }

  document.addEventListener('click', function (event) {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('touchstart', start, { passive: true });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();"
