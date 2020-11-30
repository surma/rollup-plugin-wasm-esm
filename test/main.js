import init, {a, b, c} from "wasm:./test.wasm";

async function main() {
  await init({});
  a();
  b();
  c();
}
main();
