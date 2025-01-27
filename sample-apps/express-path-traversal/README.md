# express-path-traversal

WARNING: This application contains security issues and should not be used in production (or taken as an example of how to write secure code).

In the root directory run `npm run sample-app express-path-traversal` to start the server.

Try the following URLs:

- http://localhost:4000/ : List all documents
- http://localhost:4000/?filename=/Test.txt&content=asdf : This will add a new file named Test.txt
- http://localhost:4000/?filename=/../NotAllowed.txt&content=naughty This will add a file in an unsafe file location
