const Zen = require("@aikidosec/firewall");

const fastify = require("fastify");

require("@aikidosec/firewall/nopp");

async function authenticate(request, reply) {
  const token = request.headers.authorization;
  if (!token) {
    reply.status(401).send({ error: "Authentication required" });
    return;
  }

  const users = {
    user123: { id: "user123", name: "John Doe" },
    blocked_user: { id: "blocked_user", name: "Blocked User" },
  };

  const user = users[token];
  if (!user) {
    reply.status(401).send({ error: "Invalid token" });
    return;
  }

  request.user = user;
  Zen.setUser({
    id: user.id,
    name: user.name,
  });
}

(async () => {
  const app = fastify({
    logger: true,
  });

  app.get(
    "/dashboard",
    {
      preHandler: [authenticate, Zen.fastifyHook],
    },
    async (request, reply) => {
      reply.send({
        message: "Welcome to your dashboard",
        user: request.user,
      });
    }
  );

  try {
    await app.listen({ port: getPort() });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}
