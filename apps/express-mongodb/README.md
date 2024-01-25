# express-mongodb

In the root directory run `make express-mongodb` to start the server.

Try the following URLs:

* http://localhost:3000/ add a few posts
* http://localhost:3000/?search=title search for posts with title
* http://localhost:3000/?search[$ne]=null will abuse the vulnerability parameter to return all posts