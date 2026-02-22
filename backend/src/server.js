const { createApp } = require("./app");

const { app, context } = createApp();

app.listen(context.port, () => {
  console.log(`Backend running on http://localhost:${context.port}`);
});
