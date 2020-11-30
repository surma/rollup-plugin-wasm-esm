const {wasmEsm} = require("../index.js");

export default {
  input: "main.js",
  output: {
    file: "build/main.js",
    name: "test",
    format: "esm"
  },
  plugins: [
    wasmEsm()
  ]
};
