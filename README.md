# rollup-plugin-wasm-esm

A [Rollup] plugin that allows you to import WebAssembly files as modules and does dead-code-elimination.

## Usage

### Installation

```
$ npm install --save @surma/rollup-plugin-wasm-esm
```

### Configuration

```js
// rollup.config.js
import { wasmEsm } from "@surma/rollup-plugin-wasm-esm";

export default {
  /* ... */
  plugins: [
    // ...
    wasmEsm()
    // ...
  ]
};
```

---

License Apache-2.0

[rollup]: https://rollupjs.org
