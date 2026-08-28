const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// Allow requests from your GitHub Pages website
app.use((req, res, next) => {
res.header(
"Access-Control-Allow-Origin",
"https://salimpk742-ai.github.io"
);
res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
res.header("Access-Control-Allow-Headers", "Content-Type");

if (req.method === "OPTIONS") {
return res.sendStatus(204);
}

next();
});

app.use(express.json());

// API home
app.get("/", (req, res) => {
res.json({
name: "VideoSaver API",
status: "online",
message: "VideoSaver backend is running."
});
});

// Test download endpoint
app.post("/download", (req, res) => {
const { url } = req.body;

if (!url) {
return res.status(400).json({
error: "Video URL is required."
});
}

res.json({
success: true,
message: "Video URL received successfully.",
url: url
});
});

app.listen(PORT, () => {
console.log(`VideoSaver API running on port ${PORT}`);
});
