const express = require("express");
const healthRoutes = require("./routes/health.routes");
const courseRoutes = require("./routes/course.routes");
const adminCourseRoutes = require("./routes/admin-course.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin/courses", adminCourseRoutes);

module.exports = app;
