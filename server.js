const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOINKU_API_KEY;

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
    service: "Yoinku"
  });
});


// HEALTH
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    yoinkuConfigured: Boolean(API_KEY)
  });
});


// DOWNLOAD / INFO
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
        error: "YOINKU_API_KEY is not configured."
      });
    }


    // Ask Yoinku for video information
    const infoUrl =
      "https://yoinku.com/api/v1/info?url=" +
      encodeURIComponent(url);


    const infoResponse = await fetch(
      infoUrl,
      {
        method: "GET",
        headers: {
          "x-api-key": API_KEY
        }
      }
    );


    const infoText =
      await infoResponse.text();


    let infoData;

    try {
      infoData = JSON.parse(infoText);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Yoinku returned invalid JSON.",
        yoinkuStatus: infoResponse.status,
        yoinkuResponse: infoText
      });
    }


    if (!infoResponse.ok || !infoData.ok) {
      return res.status(infoResponse.status).json({
        success: false,
        yoinkuStatus: infoResponse.status,
        yoinkuResponse: infoData
      });
    }


    /*
      Yoinku returns formats such as:

      v-1080
      v-720
      v-360
      a-mp3
      a-m4a
    */

    const videoData = infoData.data || {};

    const formats = videoData.formats || [];


    /*
      Convert Yoinku formats into the format
      your VideoSaver frontend expects.
    */

    const downloadLinks = formats.map(format => {

      let quality = format.quality || format.id;

      if (format.kind === "audio") {
        quality = "Audio";
      }

      return {
        quality: quality,
        format: format.container || "mp4",
        url:
          `/download-file?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format.id)}`,
        formatId: format.id
      };

    });


    return res.json({

      success: true,

      title:
        videoData.title || "Video",

      thumbnail:
        videoData.thumbnailUrl || "",

      duration:
        videoData.durationSeconds || 0,

      platform:
        videoData.platform || "",

      pageUrl:
        url,

      downloadLinks:
        downloadLinks

    });


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


// ACTUAL FILE DOWNLOAD
app.get("/download-file", async (req, res) => {

  try {

    const url = req.query.url;
    const format = req.query.format;

    if (!url || !format) {
      return res.status(400).json({
        success: false,
        error: "URL and format are required."
      });
    }

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "YOINKU_API_KEY is not configured."
      });
    }


    const downloadUrl =
      "https://yoinku.com/api/v1/download?url=" +
      encodeURIComponent(url) +
      "&format=" +
      encodeURIComponent(format);


    const response = await fetch(
      downloadUrl,
      {
        method: "GET",
        headers: {
          "x-api-key": API_KEY
        }
      }
    );


    /*
      Yoinku returns JSON containing a
      short-lived download URL.
    */

    const text =
      await response.text();


    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Invalid response from Yoinku.",
        response: text
      });
    }


    if (!response.ok || !data.ok) {
      return res.status(response.status).json({
        success: false,
        yoinkuStatus: response.status,
        yoinkuResponse: data
      });
    }


    if (!data.url) {
      return res.status(502).json({
        success: false,
        error: "Yoinku did not return a download URL."
      });
    }


    /*
      Redirect the user's browser directly
      to the temporary download file.
    */

    return res.redirect(data.url);


  } catch (error) {

    console.error(
      "Download file error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to create download."
    });

  }

});


app.listen(
  PORT,
  () => {
    console.log(
      `VideoSaver API running on port ${PORT}`
    );
  }
);
