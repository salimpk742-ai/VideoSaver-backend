const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.post("/download", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Please provide a video URL."
    });
  }

  try {
    const parsedUrl = new URL(url);

    res.json({
      success: true,
      message: "URL received successfully.",
      url: parsedUrl.toString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Invalid URL."
    });
  }
});

module.exports = app;
