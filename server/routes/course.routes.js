const express = require("express");
const { listPublicCourses, getPublicCourse } = require("../controllers/course.controller");

const { getPublicSalesPage } = require("../controllers/sales-page.controller");

const router = express.Router();

router.get("/", listPublicCourses);
router.get("/:slug", getPublicCourse);
router.get("/:slug/sales-page", getPublicSalesPage);

module.exports = router;
