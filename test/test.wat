(module
  (import "./glue.js" "numCores" (func $numCores (result i32)))
  (func (export "a") (result i32)
    (call $numCores)
  )
  (func (export "b") (result i32)
    i32.const 1
  )
  (func (export "c") (result i32)
    i32.const 2
  )
  (func (export "d") (result i32)
    i32.const 3
  )
  (func (export "e") (result i32)
    i32.const 4
  )
  (func (export "f") (result i32)
    i32.const 5
  )
)
