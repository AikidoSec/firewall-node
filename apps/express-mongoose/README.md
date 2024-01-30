# express-mongoose

In the root directory run `make express-mongoose` to start the server.

Try the following URLs:

* http://localhost:4000/ add a few cats
* http://localhost:4000/?search=name search for cats with name
* http://localhost:4000/?search[$ne]=null will abuse the vulnerability parameter to return all cats
