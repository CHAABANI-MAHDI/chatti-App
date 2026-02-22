const express = require("express");
const cors = require("cors");
const { buildContext } = require("./shared/context");
const registerRoutes = require("./routes/registerRoutes");

const createApp = () => {
  const app = express();
  const context = buildContext();

  app.use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "10mb" }));

  registerRoutes(app, context);

  return {
    app,
    context,
  };
};

module.exports = {
  createApp,
};
