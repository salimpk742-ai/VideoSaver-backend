const express = require("express");
const { Readable } = require("stream");

const app = express();

const PORT = process.env.PORT || 3000;


// ==========================================
// CORS
// ==========================================

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
    "Content-Type, Range"
  );

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();

});


app.use(express.json());


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "ReelGrab"
  });

});


// ==========================================
// HEALTH
// ==========================================

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    service: "ReelGrab",
    apiKeyRequired: false,
    proxyEnabled: true
  });

});


// ==========================================
// REELGRAB DOWNLOAD INFORMATION
// ==========================================

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


    const text =
      await response.text();


    let data;

    try {

      data =
        JSON.parse(text);

    } catch {

      return res.status(502).json({

        success: false,

        error:
          "ReelGrab returned invalid JSON.",

        reelGrabStatus:
          response.status,

        reelGrabResponse:
          text

      });

    }


    if (
      !response.ok ||
      data.success === false
    ) {

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


    const validLinks =
      Array.isArray(data.downloadLinks)

        ? data.downloadLinks.filter(
            link =>
              link &&
              typeof link.url === "string" &&
              link.url.trim() !== ""
          )

        : [];


    if (
      validLinks.length === 0
    ) {

      return res.status(502).json({

        success: false,

        error:
          "The video was detected, but ReelGrab did not return a downloadable file.",

        platform:
          data.platform || null,

        title:
          data.title || null,

        downloadLinks:
          data.downloadLinks || []

      });

    }


    return res.json({

      success: true,

      title:
        data.title || "",

      thumbnail:
        data.thumbnail || "",

      duration:
        data.duration || null,

      author:
        data.author || "",

      platform:
        data.platform || "",

      pageUrl:
        data.pageUrl || url,

      caption:
        data.caption || null,

      downloadLinks:
        validLinks

    });


  } catch (error) {

    console.error(
      "Download information error:",
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


// ==========================================
// VIDEO PROXY / STREAM
// ==========================================
//
// The frontend will use:
//
// /proxy?url=THE_TIKTOK_URL
//
// Instead of opening TikTok directly,
// our Vercel backend streams the file.
//
// ==========================================

app.get("/proxy", async (req, res) => {

  try {

    const mediaUrl =
      req.query.url;


    if (!mediaUrl) {

      return res.status(400).json({

        success: false,

        error:
          "Media URL is required."

      });

    }


    // Make sure this is actually a URL.
    let parsedUrl;

    try {

      parsedUrl =
        new URL(mediaUrl);

    } catch {

      return res.status(400).json({

        success: false,

        error:
          "Invalid media URL."

      });

    }


    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Only HTTP and HTTPS media URLs are supported."

      });

    }


    // ======================================
    // REQUEST HEADERS
    // ======================================

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
    };


    // Forward mobile/browser range requests.
    if (req.headers.range) {

      headers.Range =
        req.headers.range;

    }


    // ======================================
    // FETCH MEDIA
    // ======================================

    const upstream =
      await fetch(
        mediaUrl,
        {
          method: "GET",
          headers
        }
      );


    if (!upstream.ok) {

      return res.status(
        upstream.status
      ).json({

        success: false,

        error:
          "The media server rejected the download.",

        upstreamStatus:
          upstream.status

      });

    }


    // ======================================
    // COPY IMPORTANT HEADERS
    // ======================================

    const contentType =
      upstream.headers.get(
        "content-type"
      );

    const contentLength =
      upstream.headers.get(
        "content-length"
      );

    const contentRange =
      upstream.headers.get(
        "content-range"
      );

    const acceptRanges =
      upstream.headers.get(
        "accept-ranges"
      );


    if (contentType) {

      res.setHeader(
        "Content-Type",
        contentType
      );

    } else {

      res.setHeader(
        "Content-Type",
        "video/mp4"
      );

    }


    if (contentLength) {

      res.setHeader(
        "Content-Length",
        contentLength
      );

    }


    if (contentRange) {

      res.setHeader(
        "Content-Range",
        contentRange
      );

    }


    if (acceptRanges) {

      res.setHeader(
        "Accept-Ranges",
        acceptRanges
      );

    } else {

      res.setHeader(
        "Accept-Ranges",
        "bytes"
      );

    }


    // Tell browser to download rather
    // than navigate to the media URL.

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="videosaver-video.mp4"'
    );


    res.setHeader(
      "Cache-Control",
      "no-store"
    );


    // ======================================
    // STATUS
    // ======================================

    if (
      upstream.status === 206
    ) {

      res.status(206);

    } else {

      res.status(200);

    }


    // ======================================
    // STREAM MEDIA
    // ======================================

    if (
      !upstream.body
    ) {

      return res.end();

    }


    const nodeStream =
      Readable.fromWeb(
        upstream.body
      );


    nodeStream.on(
      "error",
      error => {

        console.error(
          "Media stream error:",
          error
        );

        if (!res.headersSent) {

          res.status(500);

        }

        res.end();

      }
    );


    nodeStream.pipe(res);


  } catch (error) {

    console.error(
      "Proxy error:",
      error
    );


    if (!res.headersSent) {

      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Unable to download media."

      });

    }


    res.end();

  }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(
  PORT,
  () => {

    console.log(
      `VideoSaver API running on port ${PORT}`
    );

  }
);
