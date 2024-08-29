# Build web assembly

```sh
wasm-pack build --target nodejs
```

# Usage

```js
require("./pkg/sql_tokenizer.js").tokenize_query("mysql", "SELECT * FROM users WHERE id = 'abc'")
```

```js
// Example output
[
  {
    Word: { value: 'SELECT', quote_style: undefined, keyword: 'SELECT' }
  },
  { Whitespace: 'Space' },
  'Mul',
  { Whitespace: 'Space' },
  { Word: { value: 'FROM', quote_style: undefined, keyword: 'FROM' } },
  { Whitespace: 'Space' },
  {
    Word: { value: 'users', quote_style: undefined, keyword: 'NoKeyword' }
  },
  { Whitespace: 'Space' },
  {
    Word: { value: 'WHERE', quote_style: undefined, keyword: 'WHERE' }
  },
  { Whitespace: 'Space' },
  { Word: { value: 'id', quote_style: undefined, keyword: 'ID' } },
  { Whitespace: 'Space' },
  'Eq',
  { Whitespace: 'Space' },
  { SingleQuotedString: 'abc' }
]
```

