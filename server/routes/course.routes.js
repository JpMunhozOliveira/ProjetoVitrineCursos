const express = require("express");
const { listPublicCourses, getPublicCourse } = require("../controllers/course.controller");

const router = express.Router();

router.get("/", listPublicCourses);
router.get("/:slug", getPublicCourse);

module.exports = router;
