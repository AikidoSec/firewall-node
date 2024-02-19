require("dotenv").config();
const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect({ debug: true });

const db = require('./db');
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");

function getHTMLBody(cats) {
    return `
<html lang="en">
  <body>
    <form action="/" method="GET">
      <label for="search">Add a new cat</label>
      <input type="text" name="petname">
      <input type="submit" value="Add" />
    </form>
    <p>${cats}</p>
  </body>
</html>`;
}



function getPort() {
    const port = parseInt(process.argv[2], 10) || 4000;
  
    if (isNaN(port)) {
      console.error("Invalid port");
      process.exit(1);
    }
  
    return port;
  }
  
main(getPort());  