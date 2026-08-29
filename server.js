const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;


// ===============================
// CORS
// ===============================

app.use((req, res, next) => {

  const allowedOrigins = [
    "https://salimpk742-ai.github.io",
    "https://video-saver-orcin.vercel.app"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
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
    service: "ReelGrab"
  });

});


// ===============================
// HEALTH
// ===============================

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    service: "ReelGrab",
    apiKeyRequired: false
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


    // ReelGrab API
    const apiUrl =
      "https://grabsocial.org/api/download";


    const response = await fetch(
      apiUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          url: url
        })
      }
    );


    // Read body only once
    const responseText =
      await response.text();


    let data;

    try {

      data =
        JSON.parse(responseText);

    } catch {

      return res.status(502).json({

        success: false,

        error:
          "ReelGrab returned an invalid response.",

        reelGrabStatus:
          response.status,

        reelGrabResponse:
          responseText

      });

    }


    // ReelGrab error

    if (!response.ok || data.success === false) {

      return res.status(
        response.status >= 400
          ? response.status
          : 422
      ).json({

        success: false,

        reelGrabStatus:
          response.status,

        reelGrabResponse:
          data

      });

    }


    // Return ReelGrab result directly

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
