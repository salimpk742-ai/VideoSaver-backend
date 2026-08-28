const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
res.setHeader(
"Access-Control-Allow-Origin",
"https://salimpk742-ai.github.io"
);
res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
app.get("/download", (req, res) => {
const url = req.query.url;

if (!url) {
return res.status(400).json({
success: false,
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
