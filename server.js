const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.YOINKU_API_KEY;

// Allow your frontend
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://salimpk742-ai.github.io",
    "https://video-saver-orcin.vercel.app"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "Yoinku"
  });
});


// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    yoinkuConfigured: Boolean(API_KEY)
  });
});


// ===============================
// DOWNLOAD
// ===============================

app.get("/download", async (req, res) => {

  try {

    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });
    }


    if (!API_KEY) {

      return res.status(500).json({
        success: false,
        error:
          "YOINKU_API_KEY is not configured in Vercel."
      });

    }


    /*
      Yoinku API

      The URL is passed to Yoinku.
    */

    const apiUrl =
      "https://yoinku.com/en/api";


    const response = await fetch(
      apiUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-api-key":
            API_KEY
        },

        body: JSON.stringify({
          url: url
        })
      }
    );


    let data;

    try {

      data = await response.json();

    } catch {

      const text =
        await response.text();

      return res.status(502).json({
        success: false,
        error:
          "Yoinku returned an invalid response.",
        response: text
      });

    }


    /*
      If Yoinku rejects the request,
      return its response to the frontend.
    */

    if (!response.ok) {

      return res.status(response.status).json({
        success: false,
        yoinkuStatus: response.status,
        yoinkuResponse: data
      });

    }


    /*
      Return the API response directly.

      This is important because Yoinku
      may return different formats for
      YouTube, Instagram, TikTok, etc.
    */

    return res.json(data);

  } catch (error) {

    console.error(
      "Download error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to process video."
    });

  }

});


// ===============================
// START SERVER
// ===============================

app.listen(
  PORT,
  () => {

    console.log(
      `VideoSaver API running on port ${PORT}`
    );

  }
);
