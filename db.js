const sql = require("mssql");

const config = {
    user: "sa",
    password: "Project@123",
    server: "localhost",
    database: "RegistrationDB",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

module.exports = { sql, config };