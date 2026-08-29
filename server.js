const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;
const SNAPANY_API_KEY = process.env.SNAPANY_API_KEY;

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = [
  "https://salimpk742-ai.github.io",
  "https://video-saver-orcin.vercel.app"
];

app.use((req, res, next) => {
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

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online",
    service: "SnapAny"
  });
});

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SnapAny",
    apiKeyConfigured: Boolean(SNAPANY_API_KEY)
  });
});

// --------------------------------------------------
// DOWNLOAD / EXTRACT
// --------------------------------------------------

app.get("/download", async (req, res) => {
  try {
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Video URL is required."
      });
    }

    if (!SNAPANY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "SNAPANY_API_KEY is not configured in Vercel."
      });
    }

    // ------------------------------------------------
    // Call SnapAny
    // ------------------------------------------------

    const response = await fetch(
      "https://api.snapany.com/openapi/v1/extract/post",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SNAPANY_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
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
        error: "SnapAny returned invalid JSON.",
        snapanyStatus: response.status
      });
    }

    // ------------------------------------------------
    // SnapAny error
    // ------------------------------------------------

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          data.message ||
          data.error ||
          "SnapAny could not process this URL.",
        code: data.code || null,
        snapanyStatus: response.status
      });
    }

    // ------------------------------------------------
    // Extract metadata
    // ------------------------------------------------

    const title =
      data.title ||
      data.post?.title ||
      "Video";

    const thumbnail =
      data.thumbnail_url ||
      data.thumbnail ||
      data.post?.thumbnail_url ||
      "";

    const author =
      data.author?.display_name ||
      data.author?.name ||
      data.author_name ||
      "";

    const canonicalUrl =
      data.canonical_url ||
      data.page_url ||
      url;

    // ------------------------------------------------
    // SnapAny media array
    // ------------------------------------------------

    const medias = Array.isArray(data.medias)
      ? data.medias
      : [];

    const downloadLinks = [];

    // ------------------------------------------------
    // Convert SnapAny media into our frontend format
    // ------------------------------------------------

    for (const media of medias) {
      if (!media) continue;

      const mediaType =
        String(media.media_type || "").toLowerCase();

      // Direct media URL
      if (
        media.resource_url &&
        typeof media.resource_url === "string"
      ) {
        downloadLinks.push({
          quality:
            media.quality ||
            media.resolution ||
            "Original",
          format:
            media.format ||
            (mediaType === "audio"
              ? "m4a"
              : "mp4"),
          url: media.resource_url,
          formatId:
            media.format_id ||
            media.id ||
            "download",
          size:
            media.file_size ||
            media.size ||
            null,
          headers:
            media.headers ||
            {}
        });
      }

      // ------------------------------------------------
      // Some SnapAny responses contain video variants
      // ------------------------------------------------

      const variants = Array.isArray(media.variants)
        ? media.variants
        : [];

      for (const variant of variants) {
        if (!variant) continue;

        // Complete video URL
        if (
          variant.url &&
          typeof variant.url === "string"
        ) {
          downloadLinks.push({
            quality:
              variant.quality ||
              variant.resolution ||
              "Video",
            format:
              variant.format ||
              "mp4",
            url: variant.url,
            formatId:
              variant.format_id ||
              "variant",
            size:
              variant.file_size ||
              variant.size ||
              null,
            headers:
              variant.headers ||
              media.headers ||
              {}
          });

          continue;
        }

        // Video URL supplied separately
        if (
          variant.video_url &&
          typeof variant.video_url === "string"
        ) {
          downloadLinks.push({
            quality:
              variant.quality ||
              variant.resolution ||
              "Video",
            format:
              variant.format ||
              "mp4",
            url: variant.video_url,
            formatId:
              variant.format_id ||
              "video",
            size:
              variant.file_size ||
              variant.size ||
              null,
            headers:
              variant.headers ||
              media.headers ||
              {},
            audioUrl:
              variant.audio_url ||
              null
          });
        }
      }
    }

    // ------------------------------------------------
    // Remove duplicate URLs
    // ------------------------------------------------

    const unique = [];
    const seen = new Set();

    for (const item of downloadLinks) {
      if (!item.url) continue;

      const cleanUrl = item.url.trim();

      if (!cleanUrl) continue;

      if (seen.has(cleanUrl)) continue;

      seen.add(cleanUrl);

      unique.push({
        ...item,
        url: cleanUrl
      });
    }

    // ------------------------------------------------
    // No usable media
    // ------------------------------------------------

    if (unique.length === 0) {
      return res.status(502).json({
        success: false,
        error:
          "SnapAny detected the content but did not return a downloadable media URL.",
        title,
        platform:
          data.platform ||
          data.site ||
          null,
        snapanyResponse: data
      });
    }

    // ------------------------------------------------
    // Return normalized response to frontend
    // ------------------------------------------------

    return res.json({
      success: true,
      title,
      thumbnail,
      author,
      platform:
        data.platform ||
        data.site ||
        "",
      pageUrl: canonicalUrl,
      duration:
        data.duration ||
        data.post?.duration ||
        null,
      caption:
        data.caption ||
        data.text ||
        data.post?.text ||
        null,
      downloadLinks: unique
    });

  } catch (error) {
    console.error("SnapAny error:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to process video."
    });
  }
});

// --------------------------------------------------
// PROXY
//
// IMPORTANT:
// We are NOT using this to proxy the whole video.
// It is kept only for small/compatible requests.
// Large video files should be downloaded directly
// from SnapAny's temporary resource URL.
// --------------------------------------------------

app.get("/proxy", async (req, res) => {
  try {
    const target = String(req.query.url || "").trim();

    if (!target) {
      return res.status(400).json({
        success: false,
        error: "Media URL is required."
      });
    }

    const parsed = new URL(target);

    // Only allow HTTPS media URLs
    if (parsed.protocol !== "https:") {
      return res.status(400).json({
        success: false,
        error: "Only HTTPS media URLs are allowed."
      });
    }

    const response = await fetch(target, {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          "Unable to retrieve the media file.",
        upstreamStatus: response.status
      });
    }

    const contentType =
      response.headers.get("content-type");

    if (contentType) {
      res.setHeader(
        "Content-Type",
        contentType
      );
    }

    const contentLength =
      response.headers.get("content-length");

    if (contentLength) {
      res.setHeader(
        "Content-Length",
        contentLength
      );
    }

    if (!response.body) {
      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      return res.send(buffer);
    }

    // Stream the response when supported.
    const reader =
      response.body.getReader();

    const pump = async () => {
      while (true) {
        const { done, value } =
          await reader.read();

        if (done) break;

        res.write(
          Buffer.from(value)
        );
      }

      res.end();
    };

    await pump();

  } catch (error) {
    console.error("Proxy error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Unable to proxy media."
      });
    }

    res.end();
  }
});

// --------------------------------------------------
// START
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `VideoSaver API running on port ${PORT}`
  );
});
