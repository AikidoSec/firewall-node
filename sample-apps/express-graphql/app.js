require("dotenv").config();
require("@aikidosec/firewall");

const express = require("express");
const morgan = require("morgan");
const mysql2 = require("mysql2/promise");
const {
  GraphQLSchema,
  GraphQLString,
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
} = require("graphql");
const { createHandler } = require("graphql-http/lib/use/express");

require("@aikidosec/firewall/nopp");

/** @type {mysql2.Connection} */
let dbConnection;

const schema = new GraphQLSchema({
  mutation: new GraphQLObjectType({
    name: "RootMutationType",
    fields: {
      addCat: {
        type: GraphQLBoolean,
        args: {
          petname: { type: GraphQLString },
          age: { type: GraphQLInt },
        },
        async resolve(_, args) {
          await dbConnection.execute(
            "INSERT INTO cats2 (petname, age) VALUES (?, ?)",
            [args.petname, args.age]
          );

          return true;
        },
      },
    },
  }),
  query: new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      cats: {
        type: new GraphQLList(
          new GraphQLObjectType({
            name: "Cat",
            fields: {
              petname: { type: GraphQLString },
              age: { type: GraphQLInt },
            },
          })
        ),
        args: {
          name: { type: GraphQLString },
        },
        async resolve(_, args) {
          const query = `SELECT petname, age FROM cats2 WHERE petname = '${args.name}'`;
          const [rows] = await dbConnection.execute(query);

          return rows.map((row) => ({ petname: row.petname, age: row.age }));
        },
      },
    },
  }),
});

async function createConnection() {
  // Normally you'd use environment variables for this
  const connection = await mysql2.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  await connection.execute(`
      CREATE TABLE IF NOT EXISTS cats2 (
          petname varchar(255),
          age int
      );
    `);

  return connection;
}

function getRootPage() {
  return `
  <html lang="en">
    <body>
      <p>This is a sample app vulnerable to SQL injection with GraphQL</p>
      <p>List of cats (loaded via an insecure GraphQL query):</p>
      <ul id="cats"></ul>
      <br><br>
      <form id="add-cat-form">
        <input type="text" id="petname" name="petname" placeholder="Petname" required>
        <input type="number" id="age" name="age" placeholder="Age" required>
        <button type="submit">Add cat</button>
      </form>
      <script src="/main.js"></script>
    </body>
  </html>`;
}

async function main(port) {
  dbConnection = await createConnection();
  const app = express();

  app.use(express.static("public"));
  app.use(express.json());
  app.use(morgan("tiny"));

  app.get("/", async (req, res) => {
    res.send(getRootPage());
  });

  app.all("/graphql", createHandler({ schema }));

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
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
