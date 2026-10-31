# 0028: The embedded simulator

## Choice

- `/embed` is the simulator without the site around it. Its options (program, p, inputs,
  dialect, view, readonly, panels, name) come from the address and are read by one tested
  function in `packages/embed`. **Open in Joe's SIM** opens the program in the full app.
- `<joes-sim>` is a web component that draws an iframe of `/embed` with its attributes, inside a
  shadow root. The program can be an attribute or a `<script type="text/lmc">` inside the
  element. Running in an iframe means the host page's styles and scripts cannot break it.
- The element is a plain JavaScript file (`packages/embed/src/joes-sim.js`, type-checked with
  JSDoc) served as written at `/joes-sim.js`. An earlier attempt served a compiled function's
  text, and the production minifier emptied it.
- The embed saves nothing and needs no cookies, so it works in third-party iframes.

## Learning platforms

Moodle, Sakai and Canvas usually allow iframes but remove scripts, so the docs tell teachers to
paste an iframe. The browser tests check the element in a plain HTML page, and the iframe inside
a sandboxed iframe (`allow-scripts allow-same-origin allow-popups allow-forms`), which is how
these platforms hold external content. A real Moodle and Sakai page still needs checking.
