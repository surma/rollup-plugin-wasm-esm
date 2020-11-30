/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const binaryen = require("binaryen");
const fsp = require("fs").promises;
const path = require("path");

const defaultOpts = {
  prefix: "wasm"
};

// This special import contains the `compileStreaming` polyfill.
const SPECIAL_IMPORT = "__rollup-plugin-wasm-esm_compileStreaming";
const SPECIAL_IMPORT_CONTENT = `
    export async function compileStreaming(respP) {
      if('compileStreaming' in WebAssembly) {
        return WebAssembly.compileStreaming(respP);
      }
      return respP
        .then(resp => resp.arrayBuffer())
        .then(buffer => WebAssembly.compile(buffer));
    }
  `;

function functionExportNames(module) {
  return Array.from({ length: module.getNumExports() })
    .map((_, i) => {
      let exportRef = module.getExportByIndex(i);
      return binaryen.getExportInfo(exportRef);
    })
    .filter(exportDesc => exportDesc.kind === 0 /* type function */)
    .map(exportDesc => exportDesc.name);
}

function wasmEsm(opts) {
  opts = { ...defaultOpts, ...opts };
  const marker = opts.prefix + ":";

  const handledModules = new Map();

  return {
    name: "wasm-esm",
    async resolveId(rawId, importee) {
      if (rawId === SPECIAL_IMPORT) {
        return SPECIAL_IMPORT;
      }
      if (!rawId.startsWith(marker)) {
        return;
      }
      const { id } = await this.resolve(rawId.slice(marker.length), importee);
      this.addWatchFile(id);
      return marker + id;
    },
    async load(id) {
      if (id == SPECIAL_IMPORT) {
        return SPECIAL_IMPORT_CONTENT;
      }
      if (!id.startsWith(marker)) {
        return;
      }
      const name = id.slice(marker.length);
      const source = await fsp.readFile(name);
      const referenceId = this.emitFile({
        type: "asset",
        name: path.basename(name),
        source
      });

      const wasmModule = binaryen.readBinary(new Uint8Array(source));
      const availableFunctions = new Set(functionExportNames(wasmModule));

      handledModules.set(id, {
        filePath: name,
        availableFunctions,
        wasmModule,
        usedExports: new Set(),
        referenceId
      });
      return `
        import {compileStreaming} from "${SPECIAL_IMPORT}";
        const wasmUrl = import.meta.ROLLUP_FILE_URL_${referenceId}
        const modulePromise = compileStreaming(fetch(wasmUrl));
        let instance;
        export default async function init(importObj) {
          const module = await modulePromise;
          instance = WebAssembly.instantiate(module, importObj);
        }
        ${[...availableFunctions]
          .map(
            name =>
              `export function ${name}(...args) { return instance.exports.${name}(...args); }`
          )
          .join("\n")}
      `;
    },
    generateBundle(_options, bundle) {
      // Collect all exported functions used per Wasm module across all imports
      for (const chunk of Object.values(bundle)) {
        for (const wasmModuleId of Object.keys(chunk.modules || {}).filter(id =>
          id.startsWith(marker)
        )) {
          const wasmModuleInfo = handledModules.get(wasmModuleId);
          const usedExports = chunk.modules[wasmModuleId].renderedExports;
          for (const usedExport of usedExports) {
            wasmModuleInfo.usedExports.add(usedExport);
          }
        }
      }
      // Delete unused exports and run Binaryed DCE pass
      for (const {
        availableFunctions,
        usedExports,
        wasmModule,
        referenceId
      } of handledModules.values()) {
        const deletedExports = new Set(availableFunctions);
        usedExports.forEach(v => deletedExports.delete(v));
        deletedExports.forEach(functionName =>
          wasmModule.removeExport(functionName)
        );
        // HOW??!
        // wasmModule.runPasses(["DeadCodeElimination"]);
        wasmModule.optimize();
        const binary = wasmModule.emitBinary();
        const fileName = this.getFileName(referenceId);
        bundle[fileName].source = Buffer.from(binary.buffer);
      }
    }
  };
}

module.exports = { wasmEsm };
