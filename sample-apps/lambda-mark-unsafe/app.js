const { handler } = require("./index");

// mimics the AWS Lambda environment
const event = {
  Records: [
    {
      body: JSON.stringify({
        message: "Hello from SQS",
      }),
    },
  ],
};
const context = {};
handler(event, context);
