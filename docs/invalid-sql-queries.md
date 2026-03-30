# Blocking invalid SQL queries

Zen blocks SQL queries that it can't tokenize when they contain user input. This prevents attackers from bypassing SQL injection detection with malformed queries. For example, ClickHouse ignores invalid SQL after `;`, and SQLite runs queries before an unclosed `/*` comment.

This is on by default. In blocking mode, these queries are blocked. In detection-only mode, they are reported but still executed.

If you see false positives (legitimate queries being blocked), disable it with:

```
AIKIDO_BLOCK_INVALID_SQL=false node app.js
```
