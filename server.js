/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");

const next = require("next");
const { WebSocketServer } = require("ws");

const {
  getTextareaDocument,
  setTextareaDocumentContent,
} = require("./src/lib/textarea-store.js");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const port = Number(process.env.PORT || 3000);

function broadcast(wss, payload, excludeSocket = null) {
  const message = JSON.stringify(payload);

  for (const client of wss.clients) {
    if (client === excludeSocket) {
      continue;
    }

    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket) => {
    const document = getTextareaDocument();

    socket.send(
      JSON.stringify({
        type: "textarea:init",
        content: document.content,
        updatedAt: document.updatedAt,
      }),
    );

    socket.on("message", (rawMessage) => {
      try {
        const parsedMessage = JSON.parse(rawMessage.toString());

        if (
          !parsedMessage ||
          parsedMessage.type !== "textarea:update" ||
          typeof parsedMessage.content !== "string"
        ) {
          return;
        }

        const updatedDocument = setTextareaDocumentContent(parsedMessage.content);

        broadcast(wss, {
          type: "textarea:update",
          content: updatedDocument.content,
          updatedAt: updatedDocument.updatedAt,
        }, socket);
      } catch {
        // Ignore malformed messages from clients.
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
