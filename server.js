/*
========================================
 Full Stack Registration Server
 Node.js + Express + SQL Server
========================================
*/

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const { sql, config } = require("./db");

const app = express();
const PORT = 3000;

/* ===============================
   MIDDLEWARE
================================ */

app.use(cors());
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
        console.error("❌ Database connection failed:", err);
    }
}

connectDB();


/* ===============================
   ROUTES
================================ */

app.get("/api/health", (req, res) => {
    res.json({
        status: "Server Running",
        time: new Date()
    });
});


/* REGISTER USER */

app.post("/api/register", async (req, res) => {

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    try {

        await pool.request()
            .input("username", sql.VarChar, username)
            .input("email", sql.VarChar, email)
            .input("password", sql.VarChar, password)
            .query(`
                INSERT INTO Users (username,email,password)
                VALUES (@username,@email,@password)
            `);

        res.json({
            success: true,
            message: "Registration Successful"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Database error"
        });

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
        console.log(err.message);

        startHTTP();

    }

}


/* Check if certificate files exist */

if (fs.existsSync("./cert/key.pem") && fs.existsSync("./cert/cert.pem")) {

    startHTTPS();

} else {

    console.log("⚠ SSL certificates not found.");
    startHTTP();

}