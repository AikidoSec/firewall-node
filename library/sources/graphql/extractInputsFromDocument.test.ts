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

import { visit as visitFn } from "graphql";

const AddressType = new GraphQLObjectType({
  name: "Address",
  fields: {
    street: { type: GraphQLString },
    city: { type: GraphQLString },
  },
});

const UserType = new GraphQLObjectType({
  name: "User",
  fields: {
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    age: { type: GraphQLInt },
    jobTitle: { type: GraphQLString },
    address: {
      type: AddressType,
      args: {
        city: { type: GraphQLString },
      },
      resolve(parent, args) {
        // Resolve logic for User's address
      },
    },
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
      args: {
        city: { type: GraphQLString },
      },
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
    updateUsersJobTitle: {
      type: new GraphQLList(UserType),
      args: {
        userIds: { type: new GraphQLList(GraphQLID) },
        jobTitle: { type: GraphQLString },
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
  const inputs = extractInputsFromDocument(document, visitFn);

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

  const inputs = extractInputsFromDocument(document, visitFn);

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

  const inputs = extractInputsFromDocument(document, visitFn);

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

  const inputs = extractInputsFromDocument(document, visitFn);

  t.equal(inputs.length, 2);
  t.same(inputs, ["123 Main St", "Metropolis"]);
  t.end();
});

t.test("it handles list query with argument", (t) => {
  const source = {
    query: `query {
        users(city: "Wesel") {
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

  const inputs = extractInputsFromDocument(document, visitFn);

  t.equal(inputs.length, 1);
  t.same(inputs, ["Wesel"]);
  t.end();
});

t.test("it handles list values in mutations", (t) => {
  const source = {
    query: `mutation {
        updateUsersJobTitle(userIds: ["1", "2", "3"], jobTitle: "Software Engineer") {
          id
          jobTitle
        }
      }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document, visitFn);

  t.equal(inputs.length, 4);
  t.same(inputs, ["1", "2", "3", "Software Engineer"]);
  t.end();
});

t.test("it handles queries with FragmentDefinition and InlineFragment", (t) => {
  const source = {
    query: `query {
      user(id: "user123") {
        ...userDetails
      }
    }

    fragment userDetails on User {
      id
      name
      ...on User {
        age
      }
    }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document, visitFn);

  t.equal(inputs.length, 1);
  t.same(inputs, ["user123"]);
  t.end();
});

t.test("it handles nested query with argument", (t) => {
  const source = {
    query: `query {
      users {
        id
        name
        address(city: "NestedCity") {
          street
          city
        }
      }
    }`,
  };

  const document = parse(source.query);
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    t.fail(validationErrors[0].message);
    return;
  }

  const inputs = extractInputsFromDocument(document, visitFn);

  t.equal(inputs.length, 1);
  t.same(inputs, ["NestedCity"]);
  t.end();
});

t.test("it parses default values for string arguments", (t) => {
  const source = {
    query: `query($id: ID = "default") {
      user(id: $id) {
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

  const inputs = extractInputsFromDocument(document, visitFn);

  t.same(inputs, ["default"]);
  t.end();
});
