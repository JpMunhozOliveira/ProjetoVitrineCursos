const { validate: isUuid } = require("uuid");
const pool = require("../config/database");

const COURSE_FIELDS = new Set(["title", "slug", "short_description", "status"]);

function normalizeCourseInput(body, isCreate = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const keys = Object.keys(body);
  const unknown = keys.filter((key) => !COURSE_FIELDS.has(key));

  if (unknown.length) {
    return { error: `Unsupported field(s): ${unknown.join(", ")}` };
  }

  if (isCreate && (typeof body.title !== "string" || typeof body.slug !== "string")) {
    return { error: "Fields 'title' and 'slug' are required and must be strings." };
  }

  const values = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 180) {
      return { error: "Title must contain between 1 and 180 characters." };
    }
    values.title = body.title.trim();
  }

  if ("slug" in body) {
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
      return { error: "Slug must use lowercase letters, numbers and single hyphens." };
    }
    values.slug = slug;
  }

  if ("short_description" in body) {
    if (body.short_description !== null && typeof body.short_description !== "string") {
      return { error: "short_description must be a string or null." };
    }
    values.short_description = body.short_description?.trim() || null;
  }

  if ("status" in body) {
    if (!["draft", "published", "archived"].includes(body.status)) {
      return { error: "Status must be draft, published or archived." };
    }
    values.status = body.status;
  }

  if (!isCreate && keys.length === 0) {
    return { error: "Provide at least one field to update." };
  }

  return { values };
}

function isValidId(value) {
  return isUuid(value);
}

async function listPublicCourses(_req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, short_description, status, created_at, updated_at
       FROM courses
       WHERE status = 'published'
       ORDER BY created_at DESC`
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
}

async function getPublicCourse(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, short_description, status, created_at, updated_at
       FROM courses
       WHERE slug = $1 AND status = 'published'`,
      [req.params.slug]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

async function listAdminCourses(_req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, short_description, status, created_at, updated_at
       FROM courses ORDER BY created_at DESC`
    );
    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
}

async function getAdminCourse(req, res, next) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  try {
    const result = await pool.query(
      `SELECT id, title, slug, short_description, status, created_at, updated_at
       FROM courses WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

async function createCourse(req, res, next) {
  const { values, error } = normalizeCourseInput(req.body, true);
  if (error) return res.status(400).json({ error });

  try {
    const result = await pool.query(
      `INSERT INTO courses (title, slug, short_description, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, slug, short_description, status, created_at, updated_at`,
      [
        values.title,
        values.slug,
        values.short_description ?? null,
        values.status ?? "draft",
      ]
    );
    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A course with this slug already exists." });
    }
    return next(error);
  }
}

async function updateCourse(req, res, next) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  const { values, error } = normalizeCourseInput(req.body);
  if (error) return res.status(400).json({ error });

  const fields = Object.keys(values);
  if (!fields.length) {
    return res.status(400).json({ error: "Provide at least one field to update." });
  }

  const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
  assignments.push("updated_at = CURRENT_TIMESTAMP");
  const params = [req.params.id, ...fields.map((field) => values[field])];

  try {
    const result = await pool.query(
      `UPDATE courses SET ${assignments.join(", ")}
       WHERE id = $1
       RETURNING id, title, slug, short_description, status, created_at, updated_at`,
      params
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A course with this slug already exists." });
    }
    return next(error);
  }
}

async function archiveCourse(req, res, next) {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  try {
    const result = await pool.query(
      `UPDATE courses
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, title, slug, short_description, status, created_at, updated_at`,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Course not found." });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPublicCourses,
  getPublicCourse,
  listAdminCourses,
  getAdminCourse,
  createCourse,
  updateCourse,
  archiveCourse,
};
