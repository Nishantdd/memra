import { createServer } from "node:http";

const port = process.env.PORT ?? 3000;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
