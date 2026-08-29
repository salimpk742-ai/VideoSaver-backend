const express = require("express");

const app = express();

app.use(express.json());

/* =========================
   CORS
========================= */

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
    "Content-Type, Accept"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "ReelGrab",
    version: "2.0"
  });
});


/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ReelGrab",
    proxyEnabled: true
  });
});


/* =========================
   DOWNLOAD INFORMATION
========================= */

app.get("/download", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid video URL."
      });
    }

    const supportedHosts = [
      "youtube.com",
      "youtu.be",
      "instagram.com",
      "facebook.com",
      "fb.watch",
      "tiktok.com"
    ];

    const hostname = parsedUrl.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const supported = supportedHosts.some(
      host =>
        hostname === host ||
        hostname.endsWith("." + host)
    );

    if (!supported) {
      return res.status(400).json({
        success: false,
        error: "Unsupported platform."
      });
    }


    /* =========================
       CALL GRABSOCIAL
    ========================= */

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);


    let response;

    try {
      response = await fetch(
        "https://grabsocial.org/api/download",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },

          body: JSON.stringify({
            url: url
          }),

          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }


    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Download service returned invalid JSON.",
        upstreamStatus: response.status
      });
    }


    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "Download service returned an error.",
        upstreamStatus: response.status,
        upstream: data
      });
    }


    if (data.success === false) {
      return res.status(422).json({
        success: false,
        error:
          data.error ||
          "The video could not be processed."
      });
    }


    const downloadLinks =
      Array.isArray(data.downloadLinks)
        ? data.downloadLinks
            .filter(
              item =>
                item &&
                typeof item.url === "string" &&
                item.url.trim() !== ""
            )
            .map(item => ({
              quality: item.quality || "Video",
              format: item.format || "mp4",
              url: item.url,
              formatId: item.formatId || "",
              size: item.size || null,
              referer: item.referer || null
            }))
        : [];


    if (downloadLinks.length === 0) {
      return res.status(502).json({
        success: false,
        error:
          "The video was detected, but no downloadable file was returned.",
        platform: data.platform || null,
        title: data.title || null
      });
    }


    return res.json({
      success: true,

      title: data.title || "Video",

      thumbnail: data.thumbnail || "",

      duration: data.duration || null,

      author: data.author || "",

      platform: data.platform || "",

      pageUrl: data.pageUrl || url,

      caption: data.caption || null,

      downloadLinks: downloadLinks
    });

  } catch (error) {

    console.error("DOWNLOAD ERROR:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "The download service took too long to respond."
      });
    }

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error."
    });
  }
});


/* =========================
   PROXY
========================= */

app.get("/proxy", async (req, res) => {
  try {

    const videoUrl = req.query.url;

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });
    }


    let parsed;

    try {
      parsed = new URL(videoUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid video URL."
      });
    }


    /*
      Only allow known media/CDN hosts.
    */

    const host = parsed.hostname.toLowerCase();

    const allowedHosts = [
      "tiktok.com",
      "tiktokcdn.com",
      "instagram.com",
      "cdninstagram.com",
      "fbcdn.net",
      "facebook.com",
      "googlevideo.com",
      "youtube.com",
      "youtu.be"
    ];


    const allowed = allowedHosts.some(
      allowedHost =>
        host === allowedHost ||
        host.endsWith("." + allowedHost)
    );


    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: "Media host is not allowed."
      });
    }


    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 60000);


    let response;

    try {

      response = await fetch(videoUrl, {
        method: "GET",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

          "Accept":
            "video/mp4,video/*,*/*;q=0.8",

          "Referer":
            req.query.referer || ""
        },

        signal: controller.signal
      });

    } finally {
      clearTimeout(timeout);
    }


    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error:
          "The media server returned HTTP " +
          response.status
      });
    }


    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";


    const contentLength =
      response.headers.get("content-length");


    res.status(200);

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


    res.setHeader(
      "Content-Disposition",
      'attachment; filename="VideoSaver-video.mp4"'
    );


    res.setHeader(
      "Cache-Control",
      "no-store"
    );


    /*
      Stream the video directly.
      We do NOT use response.json()
      and we do NOT read the body twice.
    */

    if (response.body) {

      const reader =
        response.body.getReader();

      try {

        while (true) {

          const {
            done,
            value
          } = await reader.read();

          if (done) {
            break;
          }

          res.write(
            Buffer.from(value)
          );
        }

      } finally {

        try {
          reader.releaseLock();
        } catch {}

      }

      return res.end();
    }


    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    return res.end(buffer);

  } catch (error) {

    console.error("PROXY ERROR:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "Media download timed out."
      });
    }

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


/* =========================
   VERCEL EXPORT
========================= */

/*
  IMPORTANT:

  Do NOT use app.listen() here.

  Vercel runs Express as a serverless
  function.
*/

module.exports = app;
