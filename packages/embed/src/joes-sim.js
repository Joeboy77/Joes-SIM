// @ts-check
/**
 * The <joes-sim> web component. It draws an iframe of the site's /embed page, so the simulator
 * runs in its own page and the host's styles and scripts cannot affect it.
 *
 * This file is served exactly as written, at /joes-sim.js, so it is plain JavaScript (type
 * checked through JSDoc) with no imports. Its options are the ones in options.ts.
 */
(function defineJoesSim() {
  if (typeof window === "undefined" || window.customElements.get("joes-sim")) return;
  const script = /** @type {HTMLScriptElement | null} */ (document.currentScript);
  const base = script && script.src ? new URL(script.src).origin : window.location.origin;
  const names = ["program", "p", "name", "dialect", "view", "inputs", "readonly", "panels"];

  class JoesSim extends HTMLElement {
    static get observedAttributes() {
      return [...names, "src", "height", "title"];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const params = new URLSearchParams();
      for (const name of names) {
        const value = this.getAttribute(name);
        if (value !== null) params.set(name, value);
      }
      // A program can also be written inside the element: <script type="text/lmc">...</script>.
      if (!params.has("program") && !params.has("p")) {
        const inline = this.querySelector('script[type="text/lmc"]')?.textContent;
        if (inline) params.set("program", inline.replace(/^\n/, ""));
      }
      const frame = document.createElement("iframe");
      frame.src = `${this.getAttribute("src") ?? base}/embed?${params.toString()}`;
      frame.title = this.getAttribute("title") ?? "Little Man Computer simulator";
      frame.loading = "lazy";
      frame.allow = "clipboard-write";
      frame.style.cssText = `display:block;width:100%;height:${this.getAttribute("height") ?? "640px"};border:1px solid #c9ced6;border-radius:8px;`;
      root.replaceChildren(frame);
    }
  }

  window.customElements.define("joes-sim", JoesSim);
})();
