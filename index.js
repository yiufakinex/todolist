import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";


const app = express();
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({server});

server.listen(8080, function() {
  console.log((new Date()) + ' Server is listening on port 8080');
});


const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "permalist",
  password: "winter1217",
  port: 5432,
});
db.connect();



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let items = [];


// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("Client connected");

  // Handle WebSocket messages
  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message);
    switch (parsedMessage.action) {
      case "add":
      case "edit":
      case "delete":
        // Broadcast message to all connected clients
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
        break;
      default:
        break;
    }
  });
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM items ORDER BY id ASC");
    items = result.rows;

    res.render("index.ejs", {
      listTitle: "Today to do list",
      listItems: items,
    });
  } catch (err) {
    console.log(err);
  }
});


app.post("/add", async (req, res) => {
  const { newItem } = req.body;
  try {
    const result = await db.query("INSERT INTO items (title) VALUES ($1) RETURNING *", [newItem]);
    const addedItem = result.rows[0];

    // Broadcast add action to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: "add", newItem: addedItem }));
      }
    });
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});



app.post("/edit", async (req, res) => {
  const { updatedItemId, updatedItemTitle } = req.body;
  try {
    await db.query("UPDATE items SET title = $1 WHERE id = $2", [updatedItemTitle, updatedItemId]);

    // Broadcast edit action to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: "edit", updatedItem: { id: updatedItemId, title: updatedItemTitle } }));
      }
    });
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.post("/delete", async (req, res) => {
  const { deleteItemId } = req.body;
  try {
    await db.query("DELETE FROM items WHERE id = $1", [deleteItemId]);

    // Broadcast delete action to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: "delete", deletedItemId: deleteItemId }));
      }
    });
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});










