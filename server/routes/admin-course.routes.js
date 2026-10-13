const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listAdminCourses,
  getAdminCourse,
  createCourse,
  updateCourse,
  archiveCourse,
} = require("../controllers/course.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listAdminCourses);
router.get("/:id", getAdminCourse);
router.post("/", createCourse);
router.patch("/:id", updateCourse);
router.delete("/:id", archiveCourse);

module.exports = router;
