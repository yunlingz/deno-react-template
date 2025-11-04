import express from "express";
import cors from "cors";

const PORT = 5000;

const app = express();

app.use(cors());

app.get("/api/welcome", (_req, res) => {
  res.send("Welcome to Deno + Express!");
});

app.use(express.static("public"));
app.use(express.static("dist"));

if (import.meta.main) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}
