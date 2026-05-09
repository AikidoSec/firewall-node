# react-router-pg Sample App

WARNING: This application contains security issues and should not be used in production (or taken as an example of how to write secure code).

In the root directory run `npm run sample-app react-router-pg` to start the server.

Try the following URLs:

- http://localhost:4000/ : List all cats
- http://localhost:4000/?petname=Kitty : This will add a new cat named "Kitty"
- http://localhost:4000/?petname=Kitty'); DELETE FROM cats;-- H : This will delete all cats

This sample app demonstrates SQL injection vulnerabilities using React Router as the web framework.
