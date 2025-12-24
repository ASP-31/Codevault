require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/User');
const File = require('./models/File');
const cors = require('cors');
const app = express();
const PORT = 3000;

// ===== Connect to MongoDB =====
mongoose.connect('mongodb+srv://asp312006:a7BWKjwgU1Pg4vhQ@mycluster.axiyoef.mongodb.net/', {
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'codevault-secret',
  resave: false,
  saveUninitialized: false
}));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== Auth Middleware =====
function isLoggedIn(req, res, next) {
  if (!req.session.userId) return res.status(401).send('Not logged in');
  next();
}
app.use(cors());


// ===== Routes =====

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).send('Username already exists');

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.send('Registered successfully');
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).send('Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send('Invalid credentials');

  req.session.userId = user._id;
  res.send('Login successful');
});

// Get all files
app.get('/api/files', isLoggedIn, async (req, res) => {
  const files = await File.find({ owner: req.session.userId }).sort({ createdAt: -1 });
  res.json(files);
});
//get users
async function getUsers(req, res) {
  const users = await User.find();
  return res.json(users);
}

// Create new file
app.post('/api/files', isLoggedIn, async (req, res) => {
  const { filename, content } = req.body;
  const file = new File({ owner: req.session.userId, filename, content });
  await file.save();
  res.send('File saved');
});

// View single file
app.get('/api/files/:id', isLoggedIn, async (req, res) => {
  const file = await File.findOne({ _id: req.params.id, owner: req.session.userId });
  if (!file) return res.status(404).send('File not found');
  res.json(file);
});

// Update file (filename or content)
app.put('/api/files/:id', isLoggedIn, async (req, res) => {
  const { filename, content } = req.body;
  try {
    const file = await File.findOneAndUpdate(
      { _id: req.params.id, owner: req.session.userId },
      { filename, content },
      { new: true }
    );

    if (!file) return res.status(404).send('File not found');
    res.json({ message: 'File updated', file });
  } catch (err) {
    res.status(500).send('Error updating file');
  }
});
// Delete file
// Delete file
app.delete('/api/files/:id', isLoggedIn, async (req, res) => {
  try {
    const file = await File.findOneAndDelete({
      _id: req.params.id,
      owner: req.session.userId
    });

    if (!file) return res.status(404).send('File not found');
    res.send('File deleted');
  } catch (err) {
    res.status(500).send('Error deleting file');
  }
});

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy(() => res.send('Logged out'));
});
app.get("/user", getUsers);
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

//reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).send('All fields required');
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();
    console.log('Password reset for user:', username);
    res.send('Password reset successful');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error resetting password');
  }
});

//changepassword
app.post('/api/change-password', isLoggedIn, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.session.userId);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).send('Current password is incorrect'); 
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.send('Password changed successfully');
  } catch (err) {
    res.status(500).send('Error changing password');
  }
});