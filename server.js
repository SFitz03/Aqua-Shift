const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
require("dotenv").config();

const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================
// CORE MIDDLEWARE
// =====================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // local development only
      httpOnly: true,
      maxAge: 1000 * 60 * 60 // 1 hour
    }
  })
);

// =====================
// AUTH MIDDLEWARE (API PROTECTION)
// =====================

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// =====================
// PAGE ROLE GATING (FRONTEND PROTECTION)
// =====================

function requireRolePage(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login.html");
    if (!roles.includes(req.session.user.role)) return res.redirect("/");
    next();
  };
}

// Root route
app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.sendFile(path.join(__dirname, "public", "login.html"));
  }

  if (req.session.user.role === "organisation") {
    return res.redirect("/org-dashboard.html");
  }

  if (req.session.user.role === "instructor") {
    return res.redirect("/instructor-dashboard.html");
  }

  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Instructor-only pages
app.get("/instructor-dashboard.html", requireRolePage("instructor", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "instructor-dashboard.html"));
});

app.get("/shifts.html", requireRolePage("instructor", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "shifts.html"));
});

app.get("/instructor-profile.html", requireRolePage("instructor", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "instructor-profile.html"));
});

app.get("/my-bookings.html", requireRolePage("instructor", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "my-bookings.html"));
});

app.get("/dbs-submit.html", requireRolePage("instructor", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "dbs-submit.html"));
});

// Organisation-only pages
app.get("/org-dashboard.html", requireRolePage("organisation", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "org-dashboard.html"));
});

app.get("/org-profile.html", requireRolePage("organisation", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "org-profile.html"));
});

app.get("/org-shifts.html", requireRolePage("organisation", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "org-shifts.html"));
});

app.get("/org-bookings.html", requireRolePage("organisation", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "org-bookings.html"));
});

app.get("/org-dbs.html", requireRolePage("organisation", "admin"), (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "org-dbs.html"));
});

// Prevent logged-in users seeing login/register again
app.get("/login.html", (req, res) => {
  if (req.session.user) return res.redirect("/");
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register.html", (req, res) => {
  if (req.session.user) return res.redirect("/");
  return res.sendFile(path.join(__dirname, "public", "register.html"));
});



// =====================
// SERVE STATIC FILES
// =====================

app.use(express.static(path.join(__dirname, "public")));

// =====================
// BASIC ROUTES
// =====================

// Health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AquaShift API running" });
});

// Database test route
app.get("/api/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SHOW TABLES");
    res.json({ connected: true, tables: rows });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// View schema of allowed tables (DEV ONLY)
app.get("/api/schema/:table", async (req, res) => {
  try {
    const table = req.params.table;

  const allowed = new Set([
  "users",
  "organisation_profiles",
  "instructor_profiles",
  "shifts",
  "bookings",
  "instructor_ratings",
  "blocked_instructors",
  "audit_logs"
]);

    if (!allowed.has(table)) {
      return res.status(400).json({ error: "Table not allowed" });
    }

    const [rows] = await db.query(`DESCRIBE \`${table}\``);
    res.json({ table, columns: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Peek at rows (DEV ONLY)
app.get("/api/peek/:table", async (req, res) => {
  try {
    const table = req.params.table;

   const allowed = new Set([
  "users",
  "organisation_profiles",
  "instructor_profiles",
  "shifts",
  "bookings",
  "instructor_ratings"
]);

    if (!allowed.has(table)) {
      return res.status(400).json({ error: "Table not allowed" });
    }

    const [rows] = await db.query(
      `SELECT * FROM \`${table}\` ORDER BY id DESC LIMIT 20`
    );
    res.json({ table, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// AUTH ROUTES
// =====================

// Register (instructor or organisation)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "name, email, password, role are required"
      });
    }

    const allowedRoles = new Set(["instructor", "organisation"]);
    if (!allowedRoles.has(role)) {
      return res.status(400).json({
        error: "role must be instructor or organisation"
      });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, password_hash, role]
    );

    req.session.user = { id: result.insertId, role, name, email };

    return res.status(201).json({ message: "Registered", user: req.session.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email
    };

    return res.json({ message: "Logged in", user: req.session.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// Current logged in user
app.get("/api/auth/me", (req, res) => {
  if (!req.session.user) return res.status(200).json({ user: null }); // ✅ changed from 401
  res.json({ user: req.session.user });
});

// =====================
// ORGANISATION PROFILE
// =====================

app.post("/api/org/profile", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const { organisation_name, postcode, contact_phone } = req.body;

    if (!organisation_name || !postcode || !contact_phone) {
      return res.status(400).json({
        error: "organisation_name, postcode, contact_phone are required"
      });
    }

    const userId = req.session.user.id;

    const [existing] = await db.query(
      "SELECT id FROM organisation_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (existing.length > 0) {
      await db.query(
        "UPDATE organisation_profiles SET organisation_name = ?, postcode = ?, contact_phone = ? WHERE user_id = ?",
        [organisation_name, postcode, contact_phone, userId]
      );

      return res.json({ message: "Organisation profile updated" });
    }

    const [result] = await db.query(
      "INSERT INTO organisation_profiles (user_id, organisation_name, postcode, contact_phone) VALUES (?, ?, ?, ?)",
      [userId, organisation_name, postcode, contact_phone]
    );

    return res.status(201).json({
      message: "Organisation profile created",
      organisation_id: result.insertId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// INSTRUCTOR PROFILE
// =====================

app.post("/api/instructor/profile", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const {
      qualification_level,
      dbs_checked,
      postcode,
      bio,
      availability_days,
      availability_start,
      availability_end
    } = req.body;

    if (!qualification_level || !postcode) {
      return res.status(400).json({
        error: "qualification_level and postcode are required"
      });
    }

    const dbs = dbs_checked ? 1 : 0;
    const userId = req.session.user.id;

    const [existing] = await db.query(
      "SELECT id FROM instructor_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE instructor_profiles
         SET qualification_level = ?, dbs_checked = ?, postcode = ?, bio = ?, availability_days = ?, availability_start = ?, availability_end = ?
         WHERE user_id = ?`,
        [
          qualification_level,
          dbs,
          postcode,
          bio || null,
          availability_days || null,
          availability_start || null,
          availability_end || null,
          userId
        ]
      );

      return res.json({ message: "Instructor profile updated" });
    }

    const [result] = await db.query(
      `INSERT INTO instructor_profiles
       (user_id, qualification_level, dbs_checked, postcode, bio, availability_days, availability_start, availability_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        qualification_level,
        dbs,
        postcode,
        bio || null,
        availability_days || null,
        availability_start || null,
        availability_end || null
      ]
    );

    return res.status(201).json({
      message: "Instructor profile created",
      instructor_id: result.insertId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// DBS VERIFICATION (REALISTIC / GDPR MINIMISED)
// =====================

// Instructor: view own DBS status
app.get("/api/instructor/dbs/me", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      `SELECT id, dbs_checked, dbs_status, dbs_check_type, dbs_issued_date,
              update_service_member, dbs_ref_last4, dbs_verified_at, dbs_verified_by
       FROM instructor_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        error: "No instructor profile found. Create it first via POST /api/instructor/profile"
      });
    }

    return res.json({ dbs: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Instructor: submit DBS details for verification (sets status to pending)
// NOTE: store minimal data. Never store full DBS certificate number.
app.post("/api/instructor/dbs/submit", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const userId = req.session.user.id;

    const {
      dbs_check_type,        // basic | standard | enhanced
      dbs_issued_date,       // YYYY-MM-DD
      update_service_member, // boolean
      dbs_ref_last4          // optional: last 4 only
    } = req.body;

    const allowedTypes = new Set(["basic", "standard", "enhanced"]);
    if (!dbs_check_type || !allowedTypes.has(dbs_check_type)) {
      return res.status(400).json({ error: "dbs_check_type must be basic, standard, or enhanced" });
    }

    if (!dbs_issued_date) {
      return res.status(400).json({ error: "dbs_issued_date is required (YYYY-MM-DD)" });
    }

    if (dbs_ref_last4 && String(dbs_ref_last4).length !== 4) {
      return res.status(400).json({ error: "dbs_ref_last4 must be exactly 4 characters if provided" });
    }

    const [profileRows] = await db.query(
      "SELECT id, dbs_status FROM instructor_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (profileRows.length === 0) {
      return res.status(400).json({
        error: "No instructor profile found. Create it first via POST /api/instructor/profile"
      });
    }

    await db.query(
      `UPDATE instructor_profiles
       SET dbs_status = 'pending',
           dbs_checked = 0,
           dbs_check_type = ?,
           dbs_issued_date = ?,
           update_service_member = ?,
           dbs_ref_last4 = ?,
           dbs_verified_at = NULL,
           dbs_verified_by = NULL,
           dbs_notes = NULL
       WHERE user_id = ?`,
      [
        dbs_check_type,
        dbs_issued_date,
        update_service_member ? 1 : 0,
        dbs_ref_last4 ? String(dbs_ref_last4) : null,
        userId
      ]
    );

    return res.json({ message: "DBS submitted for verification", status: "pending" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Organisation/Admin: verify instructor DBS
app.post("/api/org/instructors/:id/dbs/verify", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const instructorProfileId = Number(req.params.id);
    if (!Number.isInteger(instructorProfileId)) {
      return res.status(400).json({ error: "Invalid instructor profile id" });
    }

    if (req.session.user.role === "organisation") {
      const orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) return res.status(400).json({ error: "No organisation profile found for this user." });

      const [allowed] = await db.query(
        `
        SELECT 1
        FROM bookings b
        JOIN shifts s ON s.id = b.shift_id
        WHERE s.organisation_id = ? AND b.instructor_id = ?
        LIMIT 1
        `,
        [orgId, instructorProfileId]
      );

      if (allowed.length === 0) {
        return res.status(403).json({ error: "Forbidden (instructor not linked to your organisation shifts)" });
      }
    }

    const { dbs_notes } = req.body;
    const verifierUserId = req.session.user.id;

    await db.query(
      `UPDATE instructor_profiles
       SET dbs_status = 'verified',
           dbs_checked = 1,
           dbs_verified_at = CURRENT_TIMESTAMP,
           dbs_verified_by = ?,
           dbs_notes = ?
       WHERE id = ?`,
      [verifierUserId, dbs_notes ? String(dbs_notes).slice(0, 255) : null, instructorProfileId]
    );

    return res.json({ message: "Instructor DBS marked as verified", instructor_id: instructorProfileId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Organisation/Admin: reject instructor DBS
app.post("/api/org/instructors/:id/dbs/reject", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const instructorProfileId = Number(req.params.id);
    if (!Number.isInteger(instructorProfileId)) {
      return res.status(400).json({ error: "Invalid instructor profile id" });
    }

    if (req.session.user.role === "organisation") {
      const orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) return res.status(400).json({ error: "No organisation profile found for this user." });

      const [allowed] = await db.query(
        `
        SELECT 1
        FROM bookings b
        JOIN shifts s ON s.id = b.shift_id
        WHERE s.organisation_id = ? AND b.instructor_id = ?
        LIMIT 1
        `,
        [orgId, instructorProfileId]
      );

      if (allowed.length === 0) {
        return res.status(403).json({ error: "Forbidden (instructor not linked to your organisation shifts)" });
      }
    }

    const { dbs_notes } = req.body;
    const verifierUserId = req.session.user.id;

    await db.query(
      `UPDATE instructor_profiles
       SET dbs_status = 'rejected',
           dbs_checked = 0,
           dbs_verified_at = CURRENT_TIMESTAMP,
           dbs_verified_by = ?,
           dbs_notes = ?
       WHERE id = ?`,
      [verifierUserId, dbs_notes ? String(dbs_notes).slice(0, 255) : null, instructorProfileId]
    );

    return res.json({ message: "Instructor DBS marked as rejected", instructor_id: instructorProfileId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}); 

// =====================
// RATINGS
// =====================

// Organisation/Admin: rate an instructor for a completed/past accepted booking
app.post("/api/org/bookings/:id/rate", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ error: "Invalid booking id" });
    }

    const { rating, comment } = req.body;
    const numericRating = Number(rating);

   if (
  Number.isNaN(numericRating) ||
  numericRating < 1 ||
  numericRating > 5 ||
  (numericRating * 2) % 1 !== 0
) {
  return res.status(400).json({ error: "Rating must be between 1 and 5 in 0.5 steps." });
}

    let orgId = null;
    if (req.session.user.role === "organisation") {
      orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) {
        return res.status(400).json({ error: "No organisation profile found for this user." });
      }
    }

     const [rows] = await db.query(
      `
      SELECT
        b.id AS booking_id,
        b.shift_id,
        b.instructor_id,
        b.status AS booking_status,
        s.organisation_id,
        DATE_FORMAT(s.shift_date, '%Y-%m-%d') AS shift_date,
        DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today_date
      FROM bookings b
      JOIN shifts s ON s.id = b.shift_id
      WHERE b.id = ?
      ${req.session.user.role === "organisation" ? "AND s.organisation_id = ?" : ""}
      LIMIT 1
      `,
      req.session.user.role === "organisation" ? [bookingId, orgId] : [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Booking not found for this organisation." });
    }

    const booking = rows[0];

    if (booking.booking_status !== "accepted") {
      return res.status(400).json({ error: "Only accepted bookings can be rated." });
    }

    const shiftDate = booking.shift_date;
    const todayDate = booking.today_date;

    if (shiftDate > todayDate) {
      return res.status(400).json({
        error: `Cannot rate before the shift date has passed. Shift date: ${shiftDate}, today: ${todayDate}`
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM instructor_ratings WHERE booking_id = ? LIMIT 1",
      [bookingId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "This booking has already been rated." });
    }

    const [result] = await db.query(
      `
      INSERT INTO instructor_ratings
      (booking_id, shift_id, instructor_id, organisation_id, rating, comment)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        booking.booking_id,
        booking.shift_id,
        booking.instructor_id,
        booking.organisation_id,
        numericRating,
        comment ? String(comment).trim() : null
      ]
    );

    return res.status(201).json({
      message: "Rating submitted.",
      rating_id: result.insertId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Organisation/Admin: view ratings they have left
app.get("/api/org/ratings", requireRole("organisation", "admin"), async (req, res) => {
  try {
    let orgId = null;
    if (req.session.user.role === "organisation") {
      orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) {
        return res.status(400).json({ error: "No organisation profile found for this user." });
      }
    }

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.booking_id,
        r.shift_id,
        r.instructor_id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS instructor_name,
        u.email AS instructor_email,
        s.title,
        s.shift_date
      FROM instructor_ratings r
      JOIN instructor_profiles ip ON ip.id = r.instructor_id
      JOIN users u ON u.id = ip.user_id
      JOIN shifts s ON s.id = r.shift_id
      WHERE r.organisation_id = ?
      ORDER BY r.created_at DESC
      `,
      [orgId]
    );

    return res.json({ ratings: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Instructor/Admin: view own ratings
app.get("/api/instructor/ratings", requireRole("instructor", "admin"), async (req, res) => {
  try {
    let instructorProfileId = null;

    if (req.session.user.role === "instructor") {
      instructorProfileId = await getInstructorProfileIdFromSession(req);
      if (!instructorProfileId) {
        return res.status(400).json({ error: "No instructor profile found for this user." });
      }
    } else {
      return res.status(400).json({ error: "Admin instructor view not implemented for this endpoint." });
    }

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.booking_id,
        r.shift_id,
        r.rating,
        r.comment,
        r.created_at,
        s.title,
        s.shift_date,
        op.organisation_name
      FROM instructor_ratings r
      JOIN shifts s ON s.id = r.shift_id
      JOIN organisation_profiles op ON op.id = r.organisation_id
      WHERE r.instructor_id = ?
      ORDER BY r.created_at DESC
      `,
      [instructorProfileId]
    );

    return res.json({ ratings: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Instructor/Admin: rating summary
app.get("/api/instructor/ratings/summary", requireRole("instructor", "admin"), async (req, res) => {
  try {
    let instructorProfileId = null;

    if (req.session.user.role === "instructor") {
      instructorProfileId = await getInstructorProfileIdFromSession(req);
      if (!instructorProfileId) {
        return res.status(400).json({ error: "No instructor profile found for this user." });
      }
    } else {
      return res.status(400).json({ error: "Admin instructor view not implemented for this endpoint." });
    }

    const [rows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_ratings,
        ROUND(AVG(rating), 2) AS average_rating
      FROM instructor_ratings
      WHERE instructor_id = ?
      `,
      [instructorProfileId]
    );

    return res.json({
      summary: rows[0] || { total_ratings: 0, average_rating: null }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================
// SHIFT ROUTES
// =====================

app.get("/api/shifts", requireAuth, async (req, res) => {
  try {
    const status = req.query.status || "open";

    const [rows] = await db.query(
      `SELECT id, organisation_id, title, shift_date, start_time, end_time, level_required, pay_rate, status, created_at
       FROM shifts
       WHERE status = ?
       ORDER BY shift_date ASC, start_time ASC`,
      [status]
    );

    res.json({ shifts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shifts", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const { title, shift_date, start_time, end_time, level_required, pay_rate } = req.body;

    if (
      !title ||
      !shift_date ||
      !start_time ||
      !end_time ||
      !level_required ||
      pay_rate === undefined
    ) {
      return res.status(400).json({
        error: "title, shift_date, start_time, end_time, level_required, pay_rate are required"
      });
    }

    const userId = req.session.user.id;

    const [orgRows] = await db.query(
      "SELECT id FROM organisation_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (orgRows.length === 0) {
      return res.status(400).json({
        error: "No organisation profile found. Create it first via POST /api/org/profile"
      });
    }

    const organisation_id = orgRows[0].id;

    const [result] = await db.query(
      `INSERT INTO shifts (organisation_id, title, shift_date, start_time, end_time, level_required, pay_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [organisation_id, title, shift_date, start_time, end_time, level_required, pay_rate]
    );

    res.status(201).json({ message: "Shift created", shift_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shifts/:id/apply", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    if (!Number.isInteger(shiftId)) {
      return res.status(400).json({ error: "Invalid shift id" });
    }

    const userId = req.session.user.id;

    const [instrRows] = await db.query(
      "SELECT id FROM instructor_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (instrRows.length === 0) {
      return res.status(400).json({
        error: "No instructor profile found. Create it first via POST /api/instructor/profile"
      });
    }

    const instructorProfileId = instrRows[0].id;

    const [shiftRows] = await db.query(
      "SELECT id, status FROM shifts WHERE id = ? LIMIT 1",
      [shiftId]
    );

    if (shiftRows.length === 0) return res.status(404).json({ error: "Shift not found" });
    if (shiftRows[0].status !== "open") return res.status(400).json({ error: "Shift is not open" });

    const [existing] = await db.query(
      "SELECT id, status FROM bookings WHERE shift_id = ? AND instructor_id = ? LIMIT 1",
      [shiftId, instructorProfileId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "You have already applied for this shift",
        booking: existing[0]
      });
    }

    const [result] = await db.query(
      "INSERT INTO bookings (shift_id, instructor_id, status) VALUES (?, ?, 'requested')",
      [shiftId, instructorProfileId]
    );

    return res.status(201).json({
      message: "Application submitted",
      booking_id: result.insertId,
      shift_id: shiftId,
      instructor_id: instructorProfileId,
      status: "requested"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// List shifts for the logged-in organisation (their own shifts only)
app.get("/api/org/shifts", requireRole("organisation", "admin"), async (req, res) => {
  try {
    let orgId = null;

    if (req.session.user.role === "organisation") {
      orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) {
        return res.status(400).json({ error: "No organisation profile found. Create it first via Org Profile." });
      }
    }

    if (req.session.user.role === "admin" && req.query.org_id) {
      orgId = Number(req.query.org_id);
      if (!Number.isInteger(orgId)) return res.status(400).json({ error: "Invalid org_id" });
    }

    const status = req.query.status;
    const params = [orgId];
    let statusSql = "";

    if (status) {
      statusSql = "AND s.status = ?";
      params.push(status);
    }

    const [rows] = await db.query(
      `
      SELECT s.id, s.title, s.shift_date, s.start_time, s.end_time, s.level_required, s.pay_rate, s.status, s.created_at
      FROM shifts s
      WHERE s.organisation_id = ?
      ${statusSql}
      ORDER BY s.shift_date DESC, s.start_time DESC
      `,
      params
    );

    res.json({ shifts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// BOOKINGS HELPERS
// =====================

async function getOrgProfileIdFromSession(req) {
  const userId = req.session.user.id;
  const [rows] = await db.query(
    "SELECT id FROM organisation_profiles WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows.length ? rows[0].id : null;
}

async function getInstructorProfileIdFromSession(req) {
  const userId = req.session.user.id;
  const [rows] = await db.query(
    "SELECT id FROM instructor_profiles WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows.length ? rows[0].id : null;
}

// =====================
// BOOKINGS (ORG + INSTRUCTOR)
// =====================

app.get("/api/org/bookings", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const orgId = await getOrgProfileIdFromSession(req);
    if (!orgId) {
      return res.status(400).json({ error: "No organisation profile found for this user." });
    }

    const status = req.query.status;
    const params = [orgId];
    let whereStatus = "";

    if (status) {
      whereStatus = "AND b.status = ?";
      params.push(status);
    }

    const [rows] = await db.query(
      `
      SELECT
        b.id AS booking_id,
        b.shift_id,
        b.instructor_id AS instructor_profile_id,
        b.status AS booking_status,
        b.created_at AS booking_created_at,

        s.title,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.level_required,
        s.pay_rate,
        s.status AS shift_status,

        u.name AS instructor_name,
        u.email AS instructor_email,

        ip.qualification_level,
        ip.dbs_checked,
        ip.dbs_status,
        ip.dbs_check_type,
        ip.dbs_issued_date,
        ip.update_service_member,
        ip.dbs_ref_last4,
        ip.dbs_verified_at,
        ip.dbs_verified_by,

        ip.postcode AS instructor_postcode,
        ip.bio,

        r.id AS rating_id,
        r.rating,
        r.comment

      FROM bookings b
      JOIN shifts s ON s.id = b.shift_id
      JOIN instructor_profiles ip ON ip.id = b.instructor_id
      JOIN users u ON u.id = ip.user_id
      LEFT JOIN instructor_ratings r ON r.booking_id = b.id
      WHERE s.organisation_id = ?
      ${whereStatus}
      ORDER BY b.created_at DESC
      `,
      params
    );

    return res.json({ bookings: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/org/bookings/:id/accept", requireRole("organisation", "admin"), async (req, res) => {
  let conn;
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) return res.status(400).json({ error: "Invalid booking id" });

    const orgId = await getOrgProfileIdFromSession(req);
    if (!orgId) return res.status(400).json({ error: "No organisation profile found for this user." });

    conn = typeof db.getConnection === "function" ? await db.getConnection() : null;
    const q = conn ? conn.query.bind(conn) : db.query.bind(db);

    if (conn) await q("START TRANSACTION");

    const [rows] = await q(
      `
      SELECT b.id, b.status, b.shift_id
      FROM bookings b
      JOIN shifts s ON s.id = b.shift_id
      WHERE b.id = ? AND s.organisation_id = ?
      LIMIT 1
      `,
      [bookingId, orgId]
    );

    if (rows.length === 0) {
      if (conn) await q("ROLLBACK");
      return res.status(404).json({ error: "Booking not found for this organisation" });
    }
   // ✅ SAFEGUARDING: DBS must be verified before accepting
const [dbsRows] = await q(
  `
  SELECT ip.dbs_status
  FROM bookings b
  JOIN instructor_profiles ip ON ip.id = b.instructor_id
  WHERE b.id = ?
  LIMIT 1
  `,
  [bookingId]
);

const dbsStatus = (dbsRows[0]?.dbs_status || "").toLowerCase();
if (dbsStatus !== "verified") {
  if (conn) await q("ROLLBACK");
  return res.status(400).json({
    error: `Cannot accept booking: instructor DBS is '${dbsStatus || "not_submitted"}'. Must be 'verified'.`
  });
} 

    const booking = rows[0];

    if (booking.status === "accepted") {
      if (conn) await q("ROLLBACK");
      return res.status(400).json({ error: "Booking is already accepted" });
    }

    const [shiftRows] = await q("SELECT status FROM shifts WHERE id = ? LIMIT 1", [booking.shift_id]);
    if (shiftRows.length === 0) {
      if (conn) await q("ROLLBACK");
      return res.status(404).json({ error: "Shift not found" });
    }
    if (shiftRows[0].status !== "open") {
      if (conn) await q("ROLLBACK");
      return res.status(400).json({ error: "Shift is not open" });
    }

    await q("UPDATE bookings SET status = 'accepted' WHERE id = ?", [bookingId]);
    await q("UPDATE shifts SET status = 'filled' WHERE id = ?", [booking.shift_id]);
    await q(
      "UPDATE bookings SET status = 'rejected' WHERE shift_id = ? AND id <> ? AND status = 'requested'",
      [booking.shift_id, bookingId]
    );

    if (conn) await q("COMMIT");

    res.json({ message: "Booking accepted; shift filled; other requests rejected." });
  } catch (err) {
    if (conn) {
      try { await conn.query("ROLLBACK"); } catch {}
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

app.post("/api/org/bookings/:id/reject", requireRole("organisation", "admin"), async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) return res.status(400).json({ error: "Invalid booking id" });

    const orgId = await getOrgProfileIdFromSession(req);
    if (!orgId) return res.status(400).json({ error: "No organisation profile found for this user." });

    const [rows] = await db.query(
      `
      SELECT b.id, b.status
      FROM bookings b
      JOIN shifts s ON s.id = b.shift_id
      WHERE b.id = ? AND s.organisation_id = ?
      LIMIT 1
      `,
      [bookingId, orgId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Booking not found for this organisation" });

    if (rows[0].status === "accepted") {
      return res.status(400).json({ error: "Cannot reject an accepted booking (add cancel flow if needed)" });
    }

    await db.query("UPDATE bookings SET status = 'rejected' WHERE id = ?", [bookingId]);

    res.json({ message: "Booking rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/instructor/bookings", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const instructorProfileId = await getInstructorProfileIdFromSession(req);
    if (!instructorProfileId) {
      return res.status(400).json({ error: "No instructor profile found for this user." });
    }

    const [rows] = await db.query(
      `
      SELECT
        b.id AS booking_id,
        b.shift_id,
        b.status AS booking_status,
        b.created_at AS booking_created_at,

        s.title,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.level_required,
        s.pay_rate,
        s.status AS shift_status,

        op.organisation_name,
        op.postcode AS organisation_postcode,
        op.contact_phone
      FROM bookings b
      JOIN shifts s ON s.id = b.shift_id
      JOIN organisation_profiles op ON op.id = s.organisation_id
      WHERE b.instructor_id = ?
      ORDER BY b.created_at DESC
      `,
      [instructorProfileId]
    );

    res.json({ bookings: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// CANCEL ENDPOINTS (POLISH)
// =====================

app.post("/api/bookings/:id/cancel", requireRole("instructor", "admin"), async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId)) return res.status(400).json({ error: "Invalid booking id" });

    let instructorProfileId = null;
    if (req.session.user.role === "instructor") {
      instructorProfileId = await getInstructorProfileIdFromSession(req);
      if (!instructorProfileId) {
        return res.status(400).json({ error: "No instructor profile found for this user." });
      }
    }

    const [rows] = await db.query(
      "SELECT id, shift_id, instructor_id, status FROM bookings WHERE id = ? LIMIT 1",
      [bookingId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = rows[0];

    if (req.session.user.role === "instructor" && booking.instructor_id !== instructorProfileId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking already cancelled" });
    }

    if (booking.status !== "requested") {
      return res.status(400).json({ error: "Only 'requested' bookings can be cancelled" });
    }

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);

    res.json({ message: "Booking cancelled", booking_id: bookingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shifts/:id/cancel", requireRole("organisation", "admin"), async (req, res) => {
  let conn;
  try {
    const shiftId = Number(req.params.id);
    if (!Number.isInteger(shiftId)) return res.status(400).json({ error: "Invalid shift id" });

    let orgId = null;
    if (req.session.user.role === "organisation") {
      orgId = await getOrgProfileIdFromSession(req);
      if (!orgId) return res.status(400).json({ error: "No organisation profile found for this user." });
    }

    conn = typeof db.getConnection === "function" ? await db.getConnection() : null;
    const q = conn ? conn.query.bind(conn) : db.query.bind(db);
    if (conn) await q("START TRANSACTION");

    let shiftRows;
    if (req.session.user.role === "organisation") {
      [shiftRows] = await q(
        "SELECT id, status FROM shifts WHERE id = ? AND organisation_id = ? LIMIT 1",
        [shiftId, orgId]
      );
    } else {
      [shiftRows] = await q("SELECT id, status FROM shifts WHERE id = ? LIMIT 1", [shiftId]);
    }

    if (shiftRows.length === 0) {
      if (conn) await q("ROLLBACK");
      return res.status(404).json({ error: "Shift not found (or not owned by this organisation)" });
    }

    if (shiftRows[0].status === "cancelled") {
      if (conn) await q("ROLLBACK");
      return res.status(400).json({ error: "Shift already cancelled" });
    }

    await q("UPDATE shifts SET status = 'cancelled' WHERE id = ?", [shiftId]);
    await q(
      "UPDATE bookings SET status = 'cancelled' WHERE shift_id = ? AND status <> 'cancelled'",
      [shiftId]
    );

    if (conn) await q("COMMIT");

    res.json({ message: "Shift cancelled; related bookings cancelled", shift_id: shiftId });
  } catch (err) {
    if (conn) {
      try { await conn.query("ROLLBACK"); } catch {}
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});