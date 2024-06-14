import * as t from "tap";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  parse,
  validate,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLInputObjectType,
  GraphQLID,
} from "graphql";
import { extractInputsFromDocument } from "./extractInputsFromDocument";

const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    age: { type: GraphQLInt },
  },
});

const AddressType = new GraphQLObjectType({
  name: "Address",
  fields: {
    street: { type: GraphQLString },
    city: { type: GraphQLString },
  },
});

const UserInputType = new GraphQLInputObjectType({
  name: "UserInput",
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    age: { type: GraphQLInt },
    isActive: { type: GraphQLBoolean },
  },
});

const RootQueryType = new GraphQLObjectType({
  name: "RootQueryType",
  fields: {
    user: {
      type: UserType,
      args: {
        id: { type: GraphQLID },
      },
      resolve(parent, args) {
        // Add resolve logic here
      },
    },
    users: {
      type: new GraphQLList(UserType),
      resolve(parent, args) {
        // Add resolve logic here
      },
    },
  },
});

const RootMutationType = new GraphQLObjectType({
  name: "RootMutationType",
  fields: {
    createUser: {
      type: UserType,
      args: {
        input: { type: new GraphQLNonNull(UserInputType) },
      },
      resolve(parent, args) {
        // Add resolve logic here
      },
    },
    updateAddress: {
      type: AddressType,
      args: {
        street: { type: GraphQLString },
        city: { type: GraphQLString },
      },
      resolve(parent, args) {
        // Add resolve logic here
      },
    },
  },
});

const schema = new GraphQLSchema({
  query: RootQueryType,
  mutation: RootMutationType,
});

t.test("it returns correct user inputs", (t) => {
  const source = {
    query: `query { user(id: "teststring") { id name } }`,
    variables: { id: "Test" },
  };

  // Parse and validate the query
  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  // Extract user inputs from the document
  const inputs = extractInputsFromDocument(document);

  t.equal(inputs.length, 1);
  t.equal(inputs[0], "teststring");
  t.end();
});

t.test("it returns correct user inputs for different queries", (t) => {
  const source = {
    query: `query {
        user(id: "12345") {
          id
          name
          age
        }
        users {
          id
          name
        }
      }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document);

  t.equal(inputs.length, 1);
  t.equal(inputs[0], "12345");
  t.end();
});

t.test("it returns correct user inputs for mutations", (t) => {
  const source = {
    query: `mutation {
        createUser(input: { name: "John Doe", age: 30, isActive: true }) {
          id
          name
        }
      }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document);

  t.equal(inputs.length, 1);
  t.same(inputs, ["John Doe"]);
  t.end();
});

t.test("it handles nested inputs and mutations", (t) => {
  const source = {
    query: `mutation {
        updateAddress(street: "123 Main St", city: "Metropolis") {
          street
          city
        }
      }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document);

  t.equal(inputs.length, 2);
  t.same(inputs, ["123 Main St", "Metropolis"]);
  t.end();
});
