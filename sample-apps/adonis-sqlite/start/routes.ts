/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import User from "#models/user";
import router from "@adonisjs/core/services/router";

router.get("/", async () => {
  return {
    hello: "world",
  };
});

router.get("/users", async ({ request, response }) => {
  // WARNING: This is intentionally vulnerable for demonstration only!
  const id = request.input("id");

  if (!id) {
    response.abort({ message: "Missing id parameter" }, 400);
  }

  // Directly interpolating user input into the query string (vulnerable to SQL injection)
  const users = await User.query().whereRaw(`id = ${id}`);

  return users;
});

router.post("/users", async ({ request }) => {
  const data = request.only(["username", "email", "password"]);
  const user = await User.create(data);
  return user;
});
