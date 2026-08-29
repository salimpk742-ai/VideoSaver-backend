```javascript
const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

const GRABSOCIAL_API =
  "https://grabsocial.org/api/download";


// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  "https://salimpk742-ai.github.io",
  "https://video-saver-orcin.vercel.app"
];

app.use((req, res, next) => {

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Range"
  );

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


app.use(express.json());


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "ReelGrab",
    proxyEnabled: true
  });

});


// ======================================================
// HEALTH
// ======================================================

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    service: "ReelGrab",
    apiKeyRequired: false,
    proxyEnabled: true
  });

});


// ======================================================
// GET VIDEO INFORMATION
// ======================================================

app.get("/download", async (req, res) => {

  try {

    const url =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    if (!url) {

      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });

    }


    // Basic URL validation
    let parsedUrl;

    try {

      parsedUrl = new URL(url);

    } catch {

      return res.status(400).json({
        success: false,
        error: "Invalid video URL."
      });

    }


    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {

      return res.status(400).json({
        success: false,
        error: "Only HTTP and HTTPS URLs are supported."
      });

    }


    // Ask ReelGrab / GrabSocial for the media
    const response = await fetch(
      GRABSOCIAL_API,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify({
          url: url
        })
      }
    );


    // IMPORTANT:
    // Read the response body ONLY ONCE.
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
          text.substring(0, 1000)

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

        error:
          data.error ||
          "Unable to retrieve this video.",

        reelGrabStatus:
          response.status,

        reelGrabResponse:
          data

      });

    }


    const downloadLinks =
      Array.isArray(data.downloadLinks)
        ? data.downloadLinks
        : [];


    // Keep only actual URLs
    const validLinks =
      downloadLinks.filter(
        link =>
          link &&
          typeof link.url === "string" &&
          link.url.trim() !== ""
      );


    if (validLinks.length === 0) {

      return res.status(502).json({

        success: false,

        error:
          "The video was detected, but no downloadable file was returned.",

        platform:
          data.platform || null,

        title:
          data.title || null,

        downloadLinks:
          downloadLinks

      });

    }


    // Return information to frontend.
    //
    // IMPORTANT:
    // We return the original media URL to the frontend
    // only as an internal value used to construct /proxy.
    //
    // The frontend will NEVER navigate directly to it.

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


// ======================================================
// MEDIA PROXY
// ======================================================
//
// Browser requests:
//
// /proxy?url=MEDIA_URL
//
// Server fetches MEDIA_URL.
//
// Browser NEVER navigates directly to TikTok/Instagram.
// ======================================================

app.get("/proxy", async (req, res) => {

  try {

    const mediaUrl =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";


    if (!mediaUrl) {

      return res.status(400).json({
        success: false,
        error: "Media URL is required."
      });

    }


    let parsedMediaUrl;

    try {

      parsedMediaUrl =
        new URL(mediaUrl);

    } catch {

      return res.status(400).json({
        success: false,
        error: "Invalid media URL."
      });

    }


    if (
      parsedMediaUrl.protocol !== "http:" &&
      parsedMediaUrl.protocol !== "https:"
    ) {

      return res.status(400).json({
        success: false,
        error: "Invalid media URL protocol."
      });

    }


    // Forward Range header if the browser sends one.
    const requestHeaders = {

      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36",

      "Accept":
        "video/mp4,video/*,audio/*,*/*;q=0.8",

      "Referer":
        parsedMediaUrl.origin + "/"

    };


    if (req.headers.range) {

      requestHeaders.Range =
        req.headers.range;

    }


    const mediaResponse =
      await fetch(
        mediaUrl,
        {
          method: "GET",
          headers: requestHeaders,
          redirect: "follow"
        }
      );


    if (!mediaResponse.ok) {

      return res.status(
        mediaResponse.status
      ).json({

        success: false,

        error:
          "The media server returned HTTP " +
          mediaResponse.status

      });

    }


    // --------------------------------------------------
    // Response headers
    // --------------------------------------------------

    const contentType =
      mediaResponse.headers.get(
        "content-type"
      ) || "video/mp4";


    const contentLength =
      mediaResponse.headers.get(
        "content-length"
      );


    const contentRange =
      mediaResponse.headers.get(
        "content-range"
      );


    res.status(
      mediaResponse.status
    );


    res.setHeader(
      "Content-Type",
      contentType
    );


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


    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );


    // Force download instead of opening TikTok/Instagram
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="VideoSaver-video.mp4"'
    );


    // --------------------------------------------------
    // Stream response
    // --------------------------------------------------

    if (!mediaResponse.body) {

      const buffer =
        Buffer.from(
          await mediaResponse.arrayBuffer()
        );

      return res.end(buffer);

    }


    // Convert Web ReadableStream into Node stream
    const reader =
      mediaResponse.body.getReader();


    try {

      while (true) {

        const {
          done,
          value
        } =
          await reader.read();


        if (done) {
          break;
        }


        res.write(
          Buffer.from(value)
        );

      }

      res.end();

    } catch (streamError) {

      console.error(
        "Proxy streaming error:",
        streamError
      );

      if (!res.headersSent) {

        return res.status(502).json({

          success: false,

          error:
            "Media streaming failed."

        });

      }

      res.end();

    }

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

  }

});


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

  console.log(
    `VideoSaver API running on port ${PORT}`
  );

});
```
