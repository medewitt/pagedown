// Configuration script for paged.js

(function() {
  // Retrieve MathJax loading function
  function getBeforeAsync() {
    if (typeof window.PagedConfig !== "undefined") {
      if (typeof window.PagedConfig.before !== "undefined") {
        return window.PagedConfig.before;
      }
    }
    return async () => {};
  }

  var runMathJax = getBeforeAsync();

  // This function puts the sections of class front-matter in the div.front-matter-container
  async function moveToFrontMatter() {
    let frontMatter = document.querySelector('.front-matter-container');
    const items = document.querySelectorAll('.level1.front-matter');
    for (const item of items) {
      frontMatter.appendChild(item);
    }
  }

  // This function adds the class front-matter-ref to any <a></a> element
  // referring to an entry in the front matter
  async function detectFrontMatterReferences() {
    const frontMatter = document.querySelector('.front-matter-container');
    if (!frontMatter) return;
    let anchors = document.querySelectorAll('a[href^="#"]:not([href*=":"])');
    for (let a of anchors) {
      const ref = a.getAttribute('href');
      const element = document.querySelector(ref);
      if (frontMatter.contains(element)) a.classList.add('front-matter-ref');
    }
  }

  // This function expands the links in the lists of figures or tables (loft)
  async function expandLinksInLoft() {
    var items = document.querySelectorAll('.lof li, .lot li');
    for (var item of items) {
      var anchor = item.firstChild;
      anchor.innerText = item.innerText;
      item.innerText = '';
      item.append(anchor);
    }
  }

  // This function add spans for leading symbols.
  async function addLeadersSpans() {
    var anchors = document.querySelectorAll('.toc a, .lof a, .lot a');
    for (var a of anchors) {
      a.innerHTML = a.innerHTML + '<span class="leaders"></span>';
    }
  }

  /* A factory returning a function that appends short titles spans.
     The text content of these spans are reused for running titles (see default.css).
     Argument: level - An integer between 1 and 6.
  */
  function appendShortTitleSpans(level) {
    return async () => {
      var divs = Array.from(document.getElementsByClassName('level' + level));

      async function addSpan(div) {
        var mainHeader = div.getElementsByTagName('h' + level)[0];
        if (!mainHeader) return;
        var mainTitle = mainHeader.textContent;
        var spanSectionNumber = mainHeader.getElementsByClassName('header-section-number')[0];
        var mainNumber = !!spanSectionNumber ? spanSectionNumber.textContent : '';
        var runningTitle = 'shortTitle' in div.dataset ? mainNumber + ' ' + div.dataset.shortTitle : mainTitle;
        var span = document.createElement('span');
        span.className = 'shorttitle' + level;
        span.innerText = runningTitle;
        span.style.display = "none";
        mainHeader.insertAdjacentElement('afterend', span);
        if (level == 1 && div.querySelector('.level2') === null) {
          var span2 = document.createElement('span');
          span2.className = 'shorttitle2';
          span2.innerText = ' ';
          span2.style.display = "none";
          span.insertAdjacentElement('afterend', span2);
        }
      }

      for (const div of divs) {
        await addSpan(div);
      }
    };
  }

  var appendShortTitles1 = appendShortTitleSpans(1);
  var appendShortTitles2 = appendShortTitleSpans(2);

  /* Support for HTMLWidgets
     HTMLWidgets are rendered twice:
     - before Paged.js: this ensures that sufficient rooms is reserved for the widgets
     - they rebuilt after Paged.js: without this step, all the event listeners are lost
       (i.e. interactivity is lost)
  */
  window.clonedWidgets = [];

  // This function is run before HTMLWidgets are built
  async function cloneWidgets() {
    const widgets = document.querySelectorAll('.html-widget[id]');
    for (const widget of widgets) {
      clonedWidgets.push({
        id: widget.id,
        widget: widget.cloneNode()
      });
    }
  }

  // a helper to retrieve the initial element
  function getClonedWidgetFromId(id) {
    for (const widget of clonedWidgets) {
      if (widget.id === id) {
        return widget;
      }
    }
  }

  // This promise will be evaluated before Paged.js
  const HTMLWidgetsReady = new Promise((resolve) => {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        if (window.HTMLWidgets) {
          const staticRender = window.HTMLWidgets.staticRender;

          window.HTMLWidgets.before = cloneWidgets;
          window.HTMLWidgets.staticRender = () => {
            window.HTMLWidgets.before().then(staticRender());
          };
          window.HTMLWidgets.addPostRenderHandler(resolve);
        } else {
          resolve();
        }
      },
      {capture: true, once: true}
    );
  });

  // This async function is run after Paged.js
  function rebuildHTMLWidgets() {
    let widgets = document.querySelectorAll('.html-widget-static-bound');
    for (let widget of widgets) {
      if (widget.id) {
        const clone = getClonedWidgetFromId(widget.id);
        widget.insertAdjacentElement('afterend', clone.widget);
        widget.remove();
      }
    }
    return new Promise(resolve => {
      if (window.HTMLWidgets) {
        window.HTMLWidgets.addPostRenderHandler(resolve);
        window.HTMLWidgets.staticRender();
      } else {
        resolve();
      }
    });
  }

  window.PagedConfig = {
    before: async () => {
      await moveToFrontMatter();
      await detectFrontMatterReferences();
      await expandLinksInLoft();
      await Promise.all([
        addLeadersSpans(),
        appendShortTitles1(),
        appendShortTitles2()
      ]);
      await HTMLWidgetsReady;
      await saveHTMLWidgetsData();
      await runMathJax();
    },
    after: () => {
      rebuildHTMLWidgets().then(() => {
        // pagedownListener is a binder added by the chrome_print function
        // this binder exists only when chrome_print opens the html file
        if (window.pagedownListener) {
          // the html file is opened for printing
          // call the binder to signal to the R session that Paged.js has finished
          pagedownListener('');
        } else {
          // scroll to the last position before the page is reloaded
          window.scrollTo(0, sessionStorage.getItem('pagedown-scroll'));
        }
      });
    }
  };
})();
