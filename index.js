import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import session from "express-session";  
const typeofquery = {
  "0": "Audio/Visual Issue",
  "1": "Food and Water",
  "2": "Wi-Fi/Internet Issue",
  "3": "Delayed Event Schedule",
  "4": "Food/Water Shortage",
  "5": "Fire Hazard",
  "6": "Insufficient Seating/Blocked View",
  "7": "Hygiene Issues",
  "8": "Other"
};

const adminpass = "2210";
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;
app.use(express.static("public")); // If "style.css" is inside a "public" folder

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Hack",
  password: "2210",
  port: 5432,
});
db.connect();

app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.set("view engine", "ejs");
app.set("views", __dirname);
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("register");
});

app.get("/old", (req, res) => {
  res.render("olduser");
});

app.post("/register", async (req, res) => {
  const name = req.body.username;
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const phone = req.body.Phone;
  const admin = adminpass === req.body.adminPassword;

  try {
    await db.query(
      "INSERT INTO users (username, password, userPhone, is_admin) VALUES ($1, $2, $3, $4)",
      [name, hashedPassword, phone, admin]
    );
    res.render("register", { success: "User registered successfully!", error: null });
  } catch (error) {
    if (error.code === "23505") {
      res.render("register", { error: "Username or phone number already exists!", success: null });
    }
  }
});

app.post("/old", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    if (result.rows.length === 0) {
      return res.render("olduser", { error: "User not found!", success: null });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("olduser", { error: "Invalid password!", success: null });
    }

    req.session.user = {
      phone: user.userphone,
      username: user.username,
      isAdmin: user.is_admin,
    };

    res.redirect("/index");
  } catch (error) {
    console.error(error);
    res.render("olduser", { error: "Internal server error", success: null });
  }
});

app.get("/index", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/old");
  }
  try {
    const events = await db.query("SELECT * FROM events");
    const queries = await db.query("SELECT * FROM queryies WHERE done=$1", [false]);
    const pie=await db.query("SELECT typeof, COUNT(*) AS count FROM queryies GROUP BY typeof ORDER BY count DESC")
    console.log(pie.rows);
    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      eventsList: events.rows,
      queriesList: queries.rows,
      pieList:pie.rows,
      success: null,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      eventsList: [],
      queriesList: [],
      pieList:[],
      error: "Could not fetch events.",
      success: null,
    });
  }
});
app.delete("/delete/query/:queryId", async (req, res) => {
  const queryId = parseInt(req.params.queryId, 10); // Convert to integer

  if (isNaN(queryId)) {
      console.error("Invalid query ID:", req.params.queryId);
      return res.status(400).send("Invalid query ID");
  }

  try {
      await db.query("DELETE FROM queryies WHERE query_id = $1", [queryId]);
      res.send("Query deleted successfully");
  } catch (err) {
      console.error("Error deleting query:", err);
      res.status(500).send("Error deleting query");
  }
});


app.post("/index/submit", async (req, res) => {
  console.log(req.body);
  const type = req.body.type;
  const phone = req.body.hide == "1" ? "Not given" : (req.session.user ? req.session.user.phone : "Unknown");

  try {
    await db.query(
      "INSERT INTO queryies (phone, events, typeof, moreinfo) VALUES ($1, $2, $3, $4)",
      [phone, req.body.event, typeofquery[type], req.body.moreInfo]
    );

    const events = await db.query("SELECT * FROM events");
    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      eventsList: events.rows,
      success: "Query submitted successfully!",
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      error: "Error submitting query.",
      success: null,
    });
  }
});

app.post("/add/event", async (req, res) => {
  const eventName = req.body.EVENT;

  try {
    await db.query("INSERT INTO events (eventName) VALUES ($1)", [eventName]);
    const events = await db.query("SELECT * FROM events");

    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      success: "Event added successfully!",
      error: null,
      eventsList: events.rows,
    });
  } catch (error) {
    console.error(error);
    res.render("index", {
      userName: req.session.user.username,
      admin: req.session.user.isAdmin,
      error: "Error adding event.",
      success: null,
    });
  }
});
app.get("/api/pie-data", async (req, res) => {
  try {
      const pie = await db.query("SELECT typeof, COUNT(*) AS count FROM queryies GROUP BY typeof ORDER BY count DESC");
      res.json(pie.rows); // Send JSON response
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching pie chart data" });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
