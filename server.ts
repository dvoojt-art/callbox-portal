import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import prebuiltDb from "./db_portal.json";

dotenv.config();

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db_portal.json");

interface Database {
  links: any[];
  employees: any[];
}

// In-memory cache to guarantee operational consistency in Serverless runtime environments
let databaseCache: Database | null = null;

const DEFAULT_LINKS: any[] = prebuiltDb.links || [];

const DEFAULT_EMPLOYEES = prebuiltDb.employees || [
  { email: "hr@callboxinc.com", addedAt: new Date().toISOString(), role: "admin", passcode: "123456789" },
  { email: "admin_davao@callboxinc.com", addedAt: new Date().toISOString(), role: "admin", passcode: "123456789" }
];

// Initialize DB file
function loadDatabase(): Database {
  if (databaseCache) {
    return databaseCache;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      databaseCache = JSON.parse(content);
      return databaseCache!;
    }
  } catch (err) {
    console.error("Error reading database file, using prebuilt fallback:", err);
  }
  
  // Set defaults from prebuiltDb bundled statically at build-time to support read-only file systems
  databaseCache = JSON.parse(JSON.stringify(prebuiltDb));
  return databaseCache!;
}

function saveDatabase(db: Database) {
  databaseCache = db;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: JSON file write is skipped on read-only environments (such as Vercel). Changes will carry over in-memory for the runtime session.", err);
  }
}

// MySQL pool pointer and status
let pool: mysql.Pool | null = null;
let isMySqlActive = false;
let isInitializingMySql = false;

// Attempt to initialize MySQL database
async function getPool(): Promise<mysql.Pool | null> {
  if (isMySqlActive && pool) {
    return pool;
  }
  if (!process.env.DB_HOST) {
    return null;
  }
  if (isInitializingMySql) {
    return pool;
  }

  isInitializingMySql = true;
  try {
    console.log(`Connecting to MySQL database at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}...`);
    
    // Connect first without DB select to form the database if non-existent
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "",
    });

    const dbName = process.env.DB_NAME || "callbox_davao";
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConnection.end();

    // Now establish connection pool with standard database
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "",
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test access
    const conn = await pool.getConnection();
    console.log(`MySQL connected successfully to database: ${dbName}`);
    conn.release();

    // Build standard tables
    await createTablesIfNotExist();
    isMySqlActive = true;
  } catch (err: any) {
    console.warn(`[Laragon Database Status] Could not establish connection to local MySQL: ${err.message}`);
    console.warn("Using local db_portal.json file storage mode as backup.");
    pool = null;
    isMySqlActive = false;
  } finally {
    isInitializingMySql = false;
  }
  return pool;
}

async function createTablesIfNotExist() {
  if (!pool) return;

  // Create links table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      addedBy VARCHAR(255) NOT NULL,
      createdAt VARCHAR(100) NOT NULL,
      forInactive INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Safeguard: Alter table if it already exists from prior creation steps
  try {
    await pool.query("ALTER TABLE links ADD COLUMN forInactive INT DEFAULT 0");
  } catch (err) {
    // Avoid breaking if column already exists
  }

  // Create employees table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      email VARCHAR(255) PRIMARY KEY,
      addedAt VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      passcode VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Inject defaults into MySQL if they are missing
  const [rows]: [any[], any] = await pool.query("SELECT COUNT(*) as count FROM employees");
  if (rows[0].count === 0) {
    console.log("Adding default authorized administrators into active MySQL table...");
    for (const emp of DEFAULT_EMPLOYEES) {
      await pool.query(
        "INSERT INTO employees (email, addedAt, role, passcode) VALUES (?, ?, ?, ?)",
        [emp.email, emp.addedAt, emp.role, emp.passcode]
      );
    }
  }
}

// Abstract database access methods
async function getAllLinks(): Promise<any[]> {
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      const [rows]: [any[], any] = await activePool.query("SELECT * FROM links ORDER BY createdAt DESC");
      return rows.map(row => ({
        ...row,
        forInactive: !!row.forInactive
      }));
    } catch (err) {
      console.error("MySQL query error for links, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  return db.links.map(l => ({ ...l, forInactive: !!l.forInactive }));
}

async function getAllEmployees(): Promise<any[]> {
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      const [rows]: [any[], any] = await activePool.query("SELECT * FROM employees ORDER BY addedAt DESC");
      return rows;
    } catch (err) {
      console.error("MySQL query error for employees, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  return db.employees;
}

async function getEmployee(email: string): Promise<any | null> {
  const cleanEmail = email.trim().toLowerCase();
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      const [rows]: [any[], any] = await activePool.query("SELECT * FROM employees WHERE LOWER(email) = ?", [cleanEmail]);
      return rows.length > 0 ? rows[0] : null;
    } catch (err) {
      console.error("MySQL query error findEmployee, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  return db.employees.find(emp => emp.email.trim().toLowerCase() === cleanEmail) || null;
}

async function addLink(link: any): Promise<void> {
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      await activePool.query(
        "INSERT INTO links (id, title, url, description, category, addedBy, createdAt, forInactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [link.id, link.title, link.url, link.description, link.category, link.addedBy, link.createdAt, link.forInactive ? 1 : 0]
      );
      return;
    } catch (err) {
      console.error("MySQL query error insert link, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  db.links.unshift({ ...link, forInactive: !!link.forInactive });
  saveDatabase(db);
}

async function deleteLink(id: string): Promise<boolean> {
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      const [res]: [any, any] = await activePool.query("DELETE FROM links WHERE id = ?", [id]);
      return res.affectedRows > 0;
    } catch (err) {
      console.error("MySQL query error delete link, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  const initialLen = db.links.length;
  db.links = db.links.filter(link => link.id !== id);
  if (db.links.length !== initialLen) {
    saveDatabase(db);
    return true;
  }
  return false;
}

async function addEmployee(emp: any): Promise<void> {
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      await activePool.query(
        "INSERT INTO employees (email, addedAt, role, passcode) VALUES (?, ?, ?, ?)",
        [emp.email, emp.addedAt, emp.role, emp.passcode]
      );
      return;
    } catch (err) {
      console.error("MySQL query error insert employee, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  db.employees.unshift(emp);
  saveDatabase(db);
}

async function deleteEmployee(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  const activePool = await getPool();
  if (isMySqlActive && activePool) {
    try {
      const [res]: [any, any] = await activePool.query("DELETE FROM employees WHERE LOWER(email) = ?", [cleanEmail]);
      return res.affectedRows > 0;
    } catch (err) {
      console.error("MySQL query error delete employee, fallback to JSON:", err);
    }
  }
  const db = loadDatabase();
  const initialLen = db.employees.length;
  db.employees = db.employees.filter(emp => emp.email.toLowerCase() !== cleanEmail);
  if (db.employees.length !== initialLen) {
    saveDatabase(db);
    return true;
  }
  return false;
}

export const app = express();
app.use(express.json());

// API endpoints FIRST
app.get("/api/portal-data", async (req, res) => {
    try {
      const links = await getAllLinks();
      const employees = await getAllEmployees();
      res.json({ 
        links, 
        employees, 
        isMySqlActive, 
        dbHost: process.env.DB_HOST || "127.0.0.1", 
        dbName: process.env.DB_NAME || "callbox_davao",
        dbPort: Number(process.env.DB_PORT || 3306)
      });
    } catch (err) {
      res.status(500).json({ error: "Could not load portal data." });
    }
  });

  // API router to export database to Laragon MySQL SQL script
  app.get("/api/export-sql", async (req, res) => {
    try {
      const links = await getAllLinks();
      const employees = await getAllEmployees();

      let sqlDump = `-- Callbox Davao Portal MySQL Database Dump
-- Generated on: ${new Date().toISOString()}
-- For use with Laragon (HeidiSQL, phpMyAdmin, or MySQL CLI)

CREATE DATABASE IF NOT EXISTS \`callbox_davao\`;
USE \`callbox_davao\`;

-- ------------------------------------------------------
-- Table structure for table \`employees\`
-- ------------------------------------------------------
DROP TABLE IF EXISTS \`employees\`;
CREATE TABLE \`employees\` (
  \`email\` varchar(255) NOT NULL,
  \`addedAt\` varchar(100) NOT NULL,
  \`role\` varchar(50) NOT NULL,
  \`passcode\` varchar(255) NOT NULL,
  PRIMARY KEY (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Dumping data for table \`employees\`
-- ------------------------------------------------------
`;

      if (employees && employees.length > 0) {
        sqlDump += "INSERT INTO `employees` (`email`, `addedAt`, `role`, `passcode`) VALUES\n";
        const empRows = employees.map(emp => {
          const email = (emp.email || "").replace(/'/g, "''");
          const addedAt = (emp.addedAt || "").replace(/'/g, "''");
          const role = (emp.role || "").replace(/'/g, "''");
          const passcode = (emp.passcode || "").replace(/'/g, "''");
          return `('${email}', '${addedAt}', '${role}', '${passcode}')`;
        });
        sqlDump += empRows.join(",\n") + ";\n\n";
      } else {
        sqlDump += "-- No employee rows to dump\n\n";
      }

      sqlDump += `-- ------------------------------------------------------
-- Table structure for table \`links\`
-- ------------------------------------------------------
DROP TABLE IF EXISTS \`links\`;
CREATE TABLE \`links\` (
  \`id\` varchar(50) NOT NULL,
  \`title\` varchar(255) NOT NULL,
  \`url\` text NOT NULL,
  \`description\` text DEFAULT NULL,
  \`category\` varchar(100) NOT NULL,
  \`addedBy\` varchar(255) NOT NULL,
  \`createdAt\` varchar(100) NOT NULL,
  \`forInactive\` int DEFAULT 0,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Dumping data for table \`links\`
-- ------------------------------------------------------
`;

      if (links && links.length > 0) {
        sqlDump += "INSERT INTO `links` (`id`, `title`, `url`, `description`, `category`, `addedBy`, `createdAt`, `forInactive`) VALUES\n";
        const linkRows = links.map(link => {
          const id = (link.id || "").replace(/'/g, "''");
          const title = (link.title || "").replace(/'/g, "''");
          const url = (link.url || "").replace(/'/g, "''");
          const desc = (link.description || "").replace(/'/g, "''");
          const cat = (link.category || "").replace(/'/g, "''");
          const addedBy = (link.addedBy || "").replace(/'/g, "''");
          const createdAt = (link.createdAt || "").replace(/'/g, "''");
          const forInactive = link.forInactive ? 1 : 0;
          return `('${id}', '${title}', '${url}', '${desc}', '${cat}', '${addedBy}', '${createdAt}', ${forInactive})`;
        });
        sqlDump += linkRows.join(",\n") + ";\n\n";
      } else {
        sqlDump += "-- No link rows to dump\n\n";
      }

      sqlDump += `-- Dump complete. Enjoy your Laragon local database setup!\n`;

      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", "attachment; filename=callbox_davao_dump.sql");
      res.status(200).send(sqlDump);
    } catch (err: any) {
      console.error("SQL export error:", err);
      res.status(500).send(`Error generating SQL dump: ${err.message}`);
    }
  });

  // Link Auto-scanner / Analyzer
  app.post("/api/scan-link", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required to scan." });
    }

    let rawUrl = url.trim();
    // Ensure protocol is present for parsing
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = "https://" + rawUrl;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL string provided." });
    }

    const host = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;

    // Direct local heuristics for quick parsing and smart fallback
    let fallbackCategory = "General";
    if (/hr|payroll|benefits|biometric|salary|leave/i.test(host + pathname)) {
      fallbackCategory = "HR & Benefits";
    } else if (/support|ticket|helpdesk|sys|it|tech|admin/i.test(host + pathname)) {
      fallbackCategory = "IT Support";
    } else if (/pipeline|crm|leads|campaign|client|dialer|comms/i.test(host + pathname)) {
      fallbackCategory = "Campaigns";
    } else if (/davao|operations|office|hub|desk|schedule|roster|floor/i.test(host + pathname)) {
      fallbackCategory = "Operations";
    } else if (/academy|training|learn|coach|course|class/i.test(host + pathname)) {
      fallbackCategory = "Training";
    }

    // Make clean, pretty Title recommendation
    let sub = host.replace("www.", "").split(".")[0] || "Resource";
    let fallbackTitle = sub.charAt(0).toUpperCase() + sub.slice(1) + " Portal";
    if (fallbackTitle.toLowerCase() === "callboxinc portal") {
      fallbackTitle = "Callbox Web Resource";
    }
    
    // Customize title based on path if possible
    if (pathname && pathname !== "/") {
      const folders = pathname.split("/").filter(Boolean);
      if (folders.length > 0) {
        const lastPart = folders[folders.length - 1];
        const readablePart = lastPart.replace(/[-_]/g, " ");
        fallbackTitle = readablePart.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    let fallbackDescription = `Official internal Davao Callbox system resource for ${fallbackCategory.toLowerCase()} access. Please login via @callboxinc.com to continue.`;

    // Attempt to invoke Gemini API with the Modern SDK
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        // Try to fetch HTML title or meta-tags as rich context (timeout in 1.5s to avoid hanging)
        let htmlContext = "";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          const fetchRes = await fetch(rawUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (fetchRes.ok) {
            const text = await fetchRes.text();
            // extract title
            const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
            const titleText = titleMatch ? titleMatch[1].trim() : "";
            // extract meta description
            const descMatch = text.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) || text.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
            const descText = descMatch ? descMatch[1].trim() : "";
            htmlContext = `HTML Title: "${titleText}". Meta Description: "${descText}".`;
          }
        } catch (e) {
          // Keep going, fetch is secondary
        }

        const prompt = `Analyze this Destination URL: "${rawUrl}" for our internal Callbox Davao Hub portal.
${htmlContext ? `Scraped Web Metadata context: ${htmlContext}` : ""}
Generate a clean, highly professional, actual portal title, a category selection, and a helpful short description.
The Category MUST be exactly one of: "Campaigns", "Operations", "HR & Benefits", "IT Support", "Training", "General".

Your output must be returned strictly formatted as JSON according to the schema.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "A concise, clean, non-repetitive user-friendly title of the portal / website" },
                category: { type: Type.STRING, description: "Exactly one of: Campaigns, Operations, HR & Benefits, IT Support, Training, General" },
                description: { type: Type.STRING, description: "One-sentence clean professional explanation of what employees can do or find on this page" }
              },
              required: ["title", "category", "description"]
            }
          }
        });

        if (response.text) {
          const result = JSON.parse(response.text);
          if (result.title && result.category) {
            // Confirm category is one of the valid items
            const allowed = ["Campaigns", "Operations", "HR & Benefits", "IT Support", "Training", "General"];
            if (!allowed.includes(result.category)) {
              result.category = fallbackCategory;
            }
            return res.json({
              title: result.title,
              category: result.category,
              description: result.description || fallbackDescription,
              source: "gemini"
            });
          }
        }
      } catch (err) {
        console.error("Gemini scanning service error, using local fallback heuristics:", err);
      }
    }

    // fallback to smart local heuristics if no API key or failed API call
    res.json({
      title: fallbackTitle,
      category: fallbackCategory,
      description: fallbackDescription,
      source: "local-heuristics"
    });
  });

  // Employee Login validation
  app.post("/api/auth/employee-login", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // Check suffix domain restriction
    if (!trimmedEmail.endsWith("@callboxinc.com")) {
      return res.status(400).json({ 
        error: "Access Restricted: You must log in using your official @callboxinc.com email address only." 
      });
    }

    // Check if employee is registered dynamically
    let employee = await getEmployee(trimmedEmail);

    // Fallback dictionary for initial defaults
    if (!employee) {
      if (trimmedEmail === "hr@callboxinc.com" || trimmedEmail === "admin_davao@callboxinc.com") {
        employee = { email: trimmedEmail, role: "admin" };
      } else if (trimmedEmail === "ojt@callboxinc.com") {
        employee = { email: trimmedEmail, role: "viewer" };
      }
    }

    if (!employee) {
      return res.status(404).json({ 
        error: `Authorized access required. '${trimmedEmail}' is not yet in the authorized employee database. Please contact Callbox HR or Davao Admin to add your email.` 
      });
    }

    const resolvedRole = employee.role === "admin" ? "admin" : "employee";

    res.json({ success: true, user: { email: trimmedEmail, role: resolvedRole } });
  });

  // Admin Login validation
  app.post("/api/auth/admin-login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and passcode are required." });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (
      (trimmedUsername === "admin" || 
       trimmedUsername === "admin@callboxinc.com" || 
       trimmedUsername === "hr@callboxinc.com" || 
       trimmedUsername === "admin_davao@callboxinc.com") && 
      cleanPassword === "123456789"
    ) {
      const email = trimmedUsername.includes("@") ? trimmedUsername : "admin@callboxinc.com";
      return res.json({ success: true, user: { email, role: "admin" } });
    }

    // Load user and check if administrator
    const employeeAdmin = await getEmployee(trimmedUsername);

    if (employeeAdmin && employeeAdmin.role === "admin") {
      const storedPasscode = (employeeAdmin.passcode || "123456789").trim();
      if (storedPasscode === cleanPassword) {
        return res.json({ success: true, user: { email: employeeAdmin.email, role: "admin" } });
      }
    }

    res.status(401).json({ error: "Access Restricted: Invalid administrative username or passcode entered." });
  });

  // Admin and Employee link submission
  app.post("/api/links", async (req, res) => {
    // Only administrators can add links
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Access Denied: Only administrators are authorized to add links." });
    }

    const { title, url, description, category, addedBy, forInactive } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: "Title and URL are required." });
    }

    const newLink = {
      id: "l_" + Date.now(),
      title: title.trim(),
      url: url.trim(),
      description: (description || "").trim(),
      category: (category || "General").trim(),
      addedBy: addedBy || "system@callboxinc.com",
      createdAt: new Date().toISOString(),
      forInactive: !!forInactive
    };

    await addLink(newLink);
    res.status(201).json(newLink);
  });

  // Delete Link
  app.delete("/api/links/:id", async (req, res) => {
    // Only administrators can delete links
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Access Denied: Only administrators are authorized to delete links." });
    }

    const { id } = req.params;

    const deleted = await deleteLink(id);
    if (!deleted) {
      return res.status(404).json({ error: "Link not found." });
    }

    res.json({ success: true, id });
  });

  // Add Employee Authorized Email
  app.post("/api/employees", async (req, res) => {
    // Only administrators can create users (authorize employees)
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Access Denied: Only administrators are authorized to register employees." });
    }

    const { email, role, passcode } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith("@callboxinc.com")) {
      return res.status(400).json({ error: "Only @callboxinc.com domain emails are allowed." });
    }

    const exists = await getEmployee(trimmedEmail);
    if (exists) {
      return res.status(400).json({ error: "Employee email is already registered." });
    }

    const newEmployee = {
      email: trimmedEmail,
      addedAt: new Date().toISOString(),
      role: role === "admin" ? "admin" : "viewer",
      passcode: passcode ? passcode.trim() : "1234"
    };

    await addEmployee(newEmployee);
    res.status(201).json(newEmployee);
  });

  // Delete/Revoke Employee Access
  app.delete("/api/employees/:email", async (req, res) => {
    // Only administrators can revoke employee authorization
    const userRole = req.headers["x-user-role"];
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Access Denied: Only administrators are authorized to revoke employee access." });
    }

    const { email } = req.params;
    const trimmedEmail = email.trim().toLowerCase();
    
    // Prevent deleting the main tester hr so they don't break their session
    if (trimmedEmail === "hr@callboxinc.com") {
      return res.status(400).json({ error: "Cannot delete the default testing HR account for safety." });
    }

    const deleted = await deleteEmployee(trimmedEmail);
    if (!deleted) {
      return res.status(404).json({ error: "Employee email not found." });
    }

    res.json({ success: true, email: trimmedEmail });
  });

async function startServer() {
  // Attempt to initialize MySQL database connection pool (Laragon/Local/Docker support)
  await getPool();

  // Serve client production bundle or mount Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, // Force disable HMR WebSocket to completely prevent "Port 24678 in use" errors
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Callbox Davao portal server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Fatal error while bootstrapping the Callbox Davao portal server:", err);
  });
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});
