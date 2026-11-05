require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("Please set JWT_SECRET in .env to a random string of at least 32 characters.");
  process.exit(1);
}

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
  category: { type: String, enum: ["Food", "Travel", "Education", "Entertainment", "Other"], required: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Expense = mongoose.model("Expense", expenseSchema);

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please log in again." });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

function validExpense(body) {
  const description = String(body.description || "").trim();
  const amount = Number(body.amount);
  const date = new Date(body.date);
  const categories = ["Food", "Travel", "Education", "Entertainment", "Other"];
  if (!description || description.length > 120) return "Description is required (max 120 characters).";
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than zero.";
  if (!body.date || Number.isNaN(date.getTime())) return "Please provide a valid date.";
  if (!categories.includes(body.category)) return "Please select a valid category.";
  return null;
}

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || name.length > 80) return res.status(400).json({ message: "Enter a name (max 80 characters)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (password.length < 6 || password.length > 128) return res.status(400).json({ message: "Password must be 6–128 characters." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    console.error(err);
    res.status(500).json({ message: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not log in." });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
});

app.get("/api/expenses", auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 });
    res.json({ expenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load expenses." });
  }
});

app.post("/api/expenses", auth, async (req, res) => {
  const error = validExpense(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const expense = await Expense.create({
      userId: req.userId,
      description: String(req.body.description).trim(),
      amount: Number(req.body.amount),
      date: new Date(req.body.date),
      category: req.body.category
    });
    res.status(201).json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not add expense." });
  }
});

app.put("/api/expenses/:id", auth, async (req, res) => {
  const error = validExpense(req.body);
  if (error) return res.status(400).json({ message: error });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid expense ID." });
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      {
        description: String(req.body.description).trim(),
        amount: Number(req.body.amount),
        date: new Date(req.body.date),
        category: req.body.category
      },
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    res.json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not update expense." });
  }
});

app.delete("/api/expenses/:id", auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid expense ID." });
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    res.json({ message: "Expense deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not delete expense." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pockettracker")
  .then(() => {
    console.log("MongoDB connected.");
    app.listen(PORT, () => console.log(`PocketTracker running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
