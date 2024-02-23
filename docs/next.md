# Next.js

Create a new `middleware.ts`/`middleware.js` file in your src/ folder : 
```ts
export {nextMiddleware as middleware} from '@aikidosec/guard';
```

Everytime you import the pg/mysql/... library add the following code : 
```diff
- const pg = require("pg");
+ const pg = nextDbWrapper(require("pg"))
```