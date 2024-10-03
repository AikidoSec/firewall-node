import t from "tap";
import { queryContainsUserInput } from "./queryContainsUserInput";

t.test("it checks if query contains user input", async () => {
  t.same(queryContainsUserInput("SELECT * FROM 'Jonas';", "Jonas"), true);
  t.same(queryContainsUserInput("Hi I'm MJoNaSs", "jonas"), true);
  t.same(
    queryContainsUserInput("Hiya, 123^&*( is a real string", "123^&*("),
    true
  );
  t.same(queryContainsUserInput("Roses are red", "violet"), false);
});
