# express-mongodb

WARNING: This application contains security issues and should not be used in production (or taken as an example of how to write secure code).

In the root directory run `make express-mongodb` to start the server.

Try the following URLs:

* http://localhost:4000/ add a few posts
* http://localhost:4000/?search=title search for posts with title
* http://localhost:4000/?search[$ne]=null will abuse the vulnerable parameter to return all posts
* http://localhost:4000/images?url=http://localhost:80 will vulnerable parameter to fetch an image from a private server
