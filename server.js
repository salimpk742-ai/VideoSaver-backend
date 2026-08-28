```javascript
const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "VideoSaver API",
    status: "online",
    message: "VideoSaver backend is running."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.post("/api/download", async (req, res) => {

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Please provide a video URL."
    });
  }

  try {

    const parsedUrl = new URL(url);

    /*
      At this stage we only validate that the user
      supplied a valid URL.

      Actual downloading/processing will be added
      after the backend is deployed and tested.
    */

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


app.listen(PORT, () => {
  console.log(`VideoSaver API running on port ${PORT}`);
});
```
