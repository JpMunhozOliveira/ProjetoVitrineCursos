const express = require("express");
const healthRoutes = require("./routes/health.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);

module.exports = app;
