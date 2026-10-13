const express = require("express");
const adminAuth = require("../middleware/admin-auth");
const {
  listAdminCourses,
  getAdminCourse,
  createCourse,
  updateCourse,
  archiveCourse,
} = require("../controllers/course.controller");

const { getAdminSalesPage, saveAdminSalesPage } = require("../controllers/sales-page.controller");

const router = express.Router();

router.use(adminAuth);
router.get("/", listAdminCourses);
router.get("/:id", getAdminCourse);
router.post("/", createCourse);
router.patch("/:id", updateCourse);
router.delete("/:id", archiveCourse);
router.get("/:id/sales-page", getAdminSalesPage);
router.put("/:id/sales-page", saveAdminSalesPage);

module.exports = router;
