import { BetterSQLite3 } from "../sinks/BetterSQLite3";
import { ChildProcess } from "../sinks/ChildProcess";
import { ClickHouse } from "../sinks/ClickHouse";
import { Eval } from "../sinks/Eval";
import { Fetch } from "../sinks/Fetch";
import { FileSystem } from "../sinks/FileSystem";
import { Function } from "../sinks/Function";
import { HTTPRequest } from "../sinks/HTTPRequest";
import { MariaDB } from "../sinks/MariaDB";
import { MongoDB } from "../sinks/MongoDB";
import { MySQL } from "../sinks/MySQL";
import { MySQL2 } from "../sinks/MySQL2";
import { NodeSQLite } from "../sinks/NodeSqlite";
import { Path } from "../sinks/Path";
import { Postgres } from "../sinks/Postgres";
import { Postgresjs } from "../sinks/Postgresjs";
import { Shelljs } from "../sinks/Shelljs";
import { SQLite3 } from "../sinks/SQLite3";
import { Undici } from "../sinks/Undici";
import { Express } from "../sources/Express";
import { Fastify } from "../sources/Fastify";
import { FastXmlParser } from "../sources/FastXmlParser";
import { FunctionsFramework } from "../sources/FunctionsFramework";
import { GraphQL } from "../sources/GraphQL";
import { Hapi } from "../sources/Hapi";
import { Hono } from "../sources/Hono";
import { HTTPServer } from "../sources/HTTPServer";
import { Koa } from "../sources/Koa";
import { PubSub } from "../sources/PubSub";
import { Xml2js } from "../sources/Xml2js";
import { XmlMinusJs } from "../sources/XmlMinusJs";

export function getWrappers() {
  return [
    new Express(),
    new MongoDB(),
    new Postgres(),
    new MySQL(),
    new MySQL2(),
    new PubSub(),
    new FunctionsFramework(),
    new ChildProcess(),
    new FileSystem(),
    new HTTPRequest(),
    new Fetch(),
    new Undici(),
    new Path(),
    new HTTPServer(),
    new Hono(),
    new GraphQL(),
    new Xml2js(),
    new FastXmlParser(),
    new SQLite3(),
    new XmlMinusJs(),
    new Shelljs(),
    new Hapi(),
    new MariaDB(),
    new NodeSQLite(),
    new BetterSQLite3(),
    new Postgresjs(),
    new Fastify(),
    new Koa(),
    new ClickHouse(),
    new Eval(),
    new Function(),
  ];
}
