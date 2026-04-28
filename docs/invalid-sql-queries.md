# Blocking invalid SQL queries

Zen blocks SQL queries that it can't tokenize when they contain user input. This prevents attackers from bypassing SQL injection detection with malformed queries. For example, ClickHouse ignores invalid SQL after `;`, and SQLite runs queries before an unclosed `/*` comment.

This is off by default. To enable it, set the environment variable:

```
AIKIDO_BLOCK_INVALID_SQL=true node app.js
```

In blocking mode, these queries are blocked. In detection-only mode, they are reported but still executed.
