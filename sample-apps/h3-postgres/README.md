# h3-postgres

WARNING: This application contains security issues and should not be used in production (or taken as an example of how to write secure code).

In the root directory run `npm run sample-app h3-postgres` to start the server.

Try the following URLs:

- http://localhost:4000/ : List all cats
- http://localhost:4000/?petname=Kitty : This will add a new cat named "Kitty"
- http://localhost:4000/?petname=Kitty'); DELETE FROM cats_3;-- H : This will delete all cats
