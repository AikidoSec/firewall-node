# nitro-v1-postgres

WARNING: This application contains security issues and should not be used in production (or taken as an example of how to write secure code).

Run `npm run build` and then `npm start` (set `PORT` to change the port) to start the server.

Try the following URLs:

- http://localhost:3000/ : List all cats
- http://localhost:3000/?petname=Kitty : This will add a new cat named "Kitty"
- http://localhost:3000/?petname=Kitty'); DELETE FROM cats_nitro;-- H : This will delete all cats
