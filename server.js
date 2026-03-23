/*
========================================
 FINAL Full Stack Registration Server
 Node.js + Express + SQL Server
========================================
*/

const express = require("express");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const bcrypt = require("bcrypt");

const { sql, config } = require("./db");

const app = express();
const PORT = 3000;

/* ===============================
   MIDDLEWARE (FINAL CORS FIX)
================================ */

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   DATABASE CONNECTION
================================ */

let pool;

async function connectDB() {
    try {
        pool = await sql.connect(config);
        console.log("✅ Connected to SQL Server");
    } catch (err) {
        console.error("❌ DB Connection Failed. Retrying in 5s...");
        setTimeout(connectDB, 5000);
    }
}

connectDB();

/* ===============================
   GLOBAL ERROR HANDLER
================================ */

process.on("uncaughtException", err => {
    console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
    console.error("❌ Unhandled Rejection:", err);
});

/* ===============================
   ROUTES
================================ */

/* ROOT ROUTE */
app.get("/", (req, res) => {
    res.send("✅ Server is running successfully");
});

/* HEALTH CHECK */
app.get("/api/health", (req, res) => {
    res.json({
        status: "Server Running",
        time: new Date()
    });
});

/* REGISTER USER */
app.post("/api/register", async (req, res) => {

    if (!pool) {
        return res.status(500).json({
            success: false,
            message: "Database not connected"
        });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        });
    }

    try {
        // Check if user exists
        const checkUser = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT * FROM Users WHERE email = @email");

        if (checkUser.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await pool.request()
            .input("username", sql.VarChar, username)
            .input("email", sql.VarChar, email)
            .input("password", sql.VarChar, hashedPassword)
            .input("createdAt", sql.DateTime, new Date())
            .query(`
                INSERT INTO Users (username, email, password, createdAt)
                VALUES (@username, @email, @password, @createdAt)
            `);

        console.log("✅ User registered:", email);

        res.json({
            success: true,
            message: "Registration Successful"
        });

    } catch (err) {
        console.error("❌ Register Error:", err);

        res.status(500).json({
            success: false,
            message: "Database error"
        });
    }
});

/* LOGIN USER */
app.post("/api/login", async (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email & Password required"
        });
    }

    try {
        const result = await pool.request()
            .input("email", sql.VarChar, email)
            .query("SELECT * FROM Users WHERE email = @email");

        if (result.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.recordset[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        res.json({
            success: true,
            message: "Login Successful",
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        console.error("❌ Login Error:", err);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

/* GET USERS */
app.get("/api/users", async (req, res) => {
    try {
        const result = await pool.request().query("SELECT * FROM Users");
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
    }
});

/* ===============================
   SERVER START
================================ */

function startHTTP() {
    http.createServer(app).listen(PORT, () => {
        console.log("🌐 HTTP Server running");
        console.log(`👉 http://localhost:${PORT}`);
    });
}

function startHTTPS() {
    try {
        const key = fs.readFileSync("./cert/key.pem");
        const cert = fs.readFileSync("./cert/cert.pem");

        https.createServer({ key, cert }, app).listen(PORT, () => {
            console.log("🔒 HTTPS Server running");
            console.log(`👉 https://localhost:${PORT}`);
        });

    } catch (err) {
        console.log("⚠ HTTPS failed, switching to HTTP");
        startHTTP();
    }
}

/* INIT */
if (fs.existsSync("./cert/key.pem") && fs.existsSync("./cert/cert.pem")) {
    startHTTPS();
} else {
    console.log("⚠ SSL not found, using HTTP");
    startHTTP();
}
