const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

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


// HOME
app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "ReelGrab"
  });
});


// HEALTH
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ReelGrab",
    apiKeyRequired: false
  });
});


// DOWNLOAD
app.get("/download", async (req, res) => {
  try {

    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });
    }


    const response = await fetch(
      "https://grabsocial.org/api/download",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          url: url
        })
      }
    );


    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        error: "ReelGrab returned invalid JSON.",
        reelGrabStatus: response.status,
        reelGrabResponse: text
      });
    }


    if (!response.ok || data.success === false) {
      return res.status(
        response.status >= 400
          ? response.status
          : 422
      ).json({
        success: false,
        reelGrabStatus: response.status,
        reelGrabResponse: data
      });
    }


    // Keep only links that actually contain a URL.
    const validLinks = Array.isArray(data.downloadLinks)
      ? data.downloadLinks.filter(
          link =>
            link &&
            typeof link.url === "string" &&
            link.url.trim() !== ""
        )
      : [];


    // ReelGrab found the media but did not
    // provide an actual downloadable file.
    if (validLinks.length === 0) {
      return res.status(502).json({
        success: false,
        error:
          "The video was detected, but ReelGrab did not return a downloadable file.",
        platform: data.platform || null,
        title: data.title || null,
        downloadLinks: data.downloadLinks || []
      });
    }


    return res.json({
      success: true,
      title: data.title || "",
      thumbnail: data.thumbnail || "",
      duration: data.duration || null,
      author: data.author || "",
      platform: data.platform || "",
      pageUrl: data.pageUrl || url,
      caption: data.caption || null,
      downloadLinks: validLinks
    });


  } catch (error) {

    console.error("Download error:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to process video."
    });
  }
});


app.listen(PORT, () => {
  console.log(
    `VideoSaver API running on port ${PORT}`
  );
});
