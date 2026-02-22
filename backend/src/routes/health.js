const registerHealthRoute = (app) => {
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "chatti-app-backend",
      timestamp: new Date().toISOString(),
    });
  });
};

module.exports = registerHealthRoute;
