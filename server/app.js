const express = require("express");
const path = require("path");
const healthRoutes = require("./routes/health.routes");
const courseRoutes = require("./routes/course.routes");
const adminCourseRoutes = require("./routes/admin-course.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// Cabeçalhos de segurança do painel e da API administrativa.
app.use(["/admin", "/api/admin"], (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'",
  });
  next();
});

app.use("/api/health", healthRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/courses", adminCourseRoutes);

// Mantém API e frontend na mesma origem no ambiente local, evitando CORS.
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "public");
app.use(express.static(publicDir));

module.exports = app;
