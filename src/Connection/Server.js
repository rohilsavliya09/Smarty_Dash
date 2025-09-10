// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Fail-fast for production; allow local defaults in development.
 * If you want strict behavior in development, set NODE_ENV=production when running.
 */
if (process.env.NODE_ENV === 'production') {
  const requiredEnv = ['MONGODB_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ================== MONGODB CONNECTION ==================
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smarty';
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ================== EMAIL TRANSPORTER (robust) ==================
let transporter = null;

async function setupTransporter() {
  try {
    if (process.env.SMTP_URL) {
      transporter = nodemailer.createTransport(process.env.SMTP_URL);
      await transporter.verify();
      console.log('✅ Transporter configured using SMTP_URL');
      return;
    }

    // If EMAIL_USER + EMAIL_PASS present, prefer explicit gmail SMTP
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const pass = process.env.EMAIL_PASS.replace(/\s/g, ''); 
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass,
        },
      });

      try {
        await transporter.verify();
        console.log('✅ Email transporter verified (SMTP). Using EMAIL_USER.');
        return;
      } catch (err) {
        console.error('❌ SMTP verify failed with EMAIL_USER/EMAIL_PASS:', err);
        
      }
    }

    // Dev fallback: Ethereal (preview only)
    if (process.env.NODE_ENV !== 'production') {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('⚠️ Development transporter created (Ethereal). Preview URLs will be printed after sendMail.');
      return;
    }

    console.warn('⚠️ Email transporter not configured. EMAIL_USER/EMAIL_PASS missing and NODE_ENV=production.');
    transporter = null;
  } catch (err) {
    console.error('❌ Error setting up email transporter:', err);
    transporter = null;
  }
}

// ================== SCHEMAS ==================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 40 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// pre-save hash (skip if already hashed)
userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) return next();
    if (typeof this.password === 'string' && this.password.startsWith('$2')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const form_Schema = new mongoose.Schema({
  name: { type: String, required: true, minlength: 3, maxlength: 50 },
  email: { type: String, required: true },
  feedback: { type: String, required: true },
  suggestions: { type: String, required: true, minlength: 10, maxlength: 200 },
});

const TaskSchema = new mongoose.Schema({
  assigndate: { type: String, required: true }, // YYYY-MM-DD
  assigntime: { type: String, required: true }, // HH:mm
  done: { type: Boolean, required: true, default: false },
  expiredate: { type: Date, default: null }, // Date for TTL removal
  id: { type: String, required: true },
  task: { type: String, required: true },
});

const TaskRowSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  assigndate: { type: String, required: true }, // YYYY-MM-DD
  rowAssignTime: { type: String, required: true }, // HH:mm
  tasks: { type: [TaskSchema], required: true, default: [] },
});

const projectSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    projectid: { type: String },
    title: { type: String, required: true },
    description: String,
    functionality: String,
    technologies: String,
    status: { type: String, default: 'Idea' },
    notes: String,
  },
  { timestamps: true }
);

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true }, // can store hashed password or a placeholder
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
// TTL index for automatic removal
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Project = mongoose.model('Project', projectSchema);
const TaskRow = mongoose.model('TaskRow', TaskRowSchema);
const Feedback = mongoose.model('Feedback', form_Schema);
const User = mongoose.model('User', userSchema);
const OTP = mongoose.model('OTP', otpSchema);

// ================== HELPERS ==================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp, subject = 'Your OTP') {
  if (!transporter) throw new Error('Email transporter not configured');

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com',
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${subject}</h2>
        <p>Your code is:</p>
        <div style="background:#f5f5f5;padding:15px;border-radius:6px;text-align:center;font-size:22px;letter-spacing:4px;margin:18px 0;">
          <strong>${otp}</strong>
        </div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email queued for ${email}`);
    if (info.messageId) console.log('messageId:', info.messageId);
    if (info.response) console.log('response:', info.response);
    if (process.env.NODE_ENV !== 'production') {
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log('Preview URL:', preview);
    }
    return info;
  } catch (err) {
    console.error('❌ sendMail error:', {
      message: err.message,
      code: err.code,
      response: err.response,
    });
    throw err;
  }
}

async function sendProjectEmail(toEmail, projectData) {
  if (!transporter) throw new Error('Email transporter not configured');

  const mailHtml = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2>Project Details</h2>
      <p><b>Title:</b> ${projectData.title || '-'}</p>
      <p><b>Description:</b><br>${(projectData.description || '').replace(/\n/g, '<br>')}</p>
      <p><b>Functionality:</b><br>${(projectData.functionality || '').replace(/\n/g, '<br>')}</p>
      <p><b>Technologies:</b><br>${(projectData.technologies || '').replace(/\n/g, '<br>')}</p>
      <p><b>Status:</b> ${projectData.status || '-'}</p>
      <p><b>Notes:</b><br>${(projectData.notes || '').replace(/\n/g, '<br>')}</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com',
    to: toEmail,
    subject: `Project Info: ${projectData.title || 'No title'}`,
    html: mailHtml,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Project email sent to ${toEmail}`);
  if (process.env.NODE_ENV !== 'production') {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Preview URL:', preview);
  }
  return info;
}

// ================== JWT middleware ==================
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token' });
      req.user = user;
      next();
    });
  } catch (err) {
    next(err);
  }
};

// ================== BACKGROUND CLEANUP ==================
// Remove tasks where done:true AND expiredate <= now (runs every minute)
setInterval(async () => {
  try {
    const now = new Date();
    const res = await TaskRow.updateMany({}, { $pull: { tasks: { done: true, expiredate: { $lte: now } } } });
    if (res.modifiedCount > 0) {
      console.log(`🧹 Cleaned ${res.modifiedCount} TaskRow documents (pulled expired done tasks)`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 60 * 1000);

// ================== ROUTES ==================
// Health
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running successfully', timestamp: new Date().toISOString() });
});

// ---------------- Tasks ----------------
app.get('/api/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    let row = await TaskRow.findOne({ userId });
    if (!row) {
      const now = new Date();
      row = new TaskRow({
        userId,
        assigndate: now.toISOString().split('T')[0],
        rowAssignTime: now.toTimeString().slice(0, 5),
        tasks: [],
      });
      await row.save();
    }

    // keep only current month tasks (persistently)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    row.tasks = row.tasks.filter((t) => {
      if (!t.assigndate) return false;
      const [year, month] = t.assigndate.split('-');
      return year === String(currentYear) && month === currentMonth;
    });
    await row.save();

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = row.tasks.filter((t) => t.assigndate === today);
    res.json(todayTasks);
  } catch (err) {
    console.error('Fetch tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add Task
app.post('/api/add-task/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const newTask = req.body;

    if (!newTask || !newTask.id || !newTask.task || !newTask.assigndate || !newTask.assigntime) {
      return res.status(400).json({ error: 'Invalid task payload' });
    }

    let row = await TaskRow.findOne({ userId });

    if (!row) {
      const now = new Date();
      row = new TaskRow({
        userId,
        assigndate: now.toISOString().split('T')[0],
        rowAssignTime: now.toTimeString().slice(0, 5),
        tasks: [newTask],
      });
    } else {
      row.tasks.push(newTask);
    }

    await row.save();
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Get all tasks of a user
app.get('/api/get-tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const row = await TaskRow.findOne({ userId });

    if (!row) return res.json({ tasks: [] });

    res.json({ tasks: row.tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Delete a task
app.delete('/api/delete-task/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const row = await TaskRow.findOne({ userId });

    if (!row) return res.status(404).json({ error: "User not found" });

    row.tasks = row.tasks.filter(t => t.id !== taskId);
    await row.save();

    res.json({ message: "Task deleted", tasks: row.tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Update a task (done toggle, expiredate, etc.)
app.put('/api/update-task/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const updatedTask = req.body;

    const row = await TaskRow.findOne({ userId });
    if (!row) return res.status(404).json({ error: "User not found" });

    row.tasks = row.tasks.map(t => (t.id === taskId ? { ...t.toObject(), ...updatedTask } : t));
    await row.save();

    res.json({ message: "Task updated", tasks: row.tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/delete-task/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const row = await TaskRow.findOne({ userId });
    if (!row) return res.status(404).json({ error: 'User not found' });

    const originalLength = row.tasks.length;
    row.tasks = row.tasks.filter((t) => t.id !== taskId);

    if (row.tasks.length === originalLength) return res.status(404).json({ error: 'Task not found' });

    await row.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/toggle-done/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const row = await TaskRow.findOne({ userId });
    if (!row) return res.status(404).json({ error: 'User not found' });

    const task = row.tasks.find((t) => t.id === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.done = !task.done;
    if (task.done) {
      const expire = new Date();
      expire.setMinutes(expire.getMinutes() + 10); // 10 minutes TTL after marking done
      task.expiredate = expire;
    } else {
      task.expiredate = null;
    }

    await row.save();
    res.json({ success: true, task });
  } catch (err) {
    console.error('Toggle done error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/edit-task/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const { task: updatedText, timerMs, assignedTo } = req.body;

    if (!updatedText) return res.status(400).json({ error: 'Task text required' });

    const row = await TaskRow.findOne({ userId });
    if (!row) return res.status(404).json({ error: 'User not found' });

    const task = row.tasks.find((t) => t.id === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.task = updatedText;
    task.text = updatedText;
    if (timerMs !== undefined) task.timerMs = timerMs;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;

    await row.save();
    res.json({ success: true, task });
  } catch (err) {
    console.error('Edit task error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Feedback ----------------
app.post('/api/users/feedback', async (req, res, next) => {
  try {
    const form_data = req.body;
    const fb = new Feedback(form_data);
    await fb.save();
    return res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Feedback error:', error);
    return next(error);
  }
});

// ---------------- Registration & OTP flows ----------------
// Register: request OTP or direct create
app.post('/api/users/register', async (req, res, next) => {
  try {
    const { username, email, password, action } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    // check existing
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'User with this email already exists' : 'Username is already taken',
      });
    }

    if (action === 'request_otp') {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // remove prior
      await OTP.deleteMany({ email });

      const hashedPassword = await bcrypt.hash(password, 10);

      const newOtp = new OTP({
        email,
        otp,
        username,
        password: hashedPassword, // store hashed password to avoid rehash later
        expiresAt,
      });
      await newOtp.save();

      try {
        await sendOTPEmail(email, otp, 'Registration OTP');
        return res.json({ message: 'OTP sent to your email', email });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        return res.status(500).json({ error: 'Failed to send OTP email' });
      }
    } else {
      // Direct register (no OTP)
      const user = new User({ username, email, password, isVerified: true });
      await user.save();
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return res.status(201).json({
        message: 'User created successfully',
        user: { id: user._id, username: user.username, email: user.email },
        token,
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
});

// Verify OTP (for registration)
app.post('/api/users/verify-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    let { otp } = req.body;
    if (!email || otp === undefined || otp === null) return res.status(400).json({ error: 'Email and OTP are required' });

    // normalize incoming OTP to trimmed string
    otp = String(otp).trim();

    // helpful dev log (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[VERIFY-OTP] incoming', { email, otp });
    }

    // Find by email and OTP string
    const otpRecord = await OTP.findOne({ email, otp });

    // If not found, try a fallback search (in case OTP stored as number or with whitespace)
    if (!otpRecord) {
      const maybeNumber = Number(otp);
      const orQuery = [{ email, otp }, { email, otp: String(maybeNumber) }, { email, otp: maybeNumber }];
      const fallback = await OTP.findOne({ $or: orQuery });
      if (fallback) {
        // found by fallback, assign it
        if (process.env.NODE_ENV !== 'production') console.log('[VERIFY-OTP] fallback matched OTP record');
        // continue with fallback
        otpRecord = fallback;
      }
    }

    if (!otpRecord) {
      if (process.env.NODE_ENV !== 'production') {
        // show any existing OTPs for this email (debug only)
        const list = await OTP.find({ email }).lean();
        console.log('[VERIFY-OTP] OTPs in DB for email:', email, list);
      }
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // ensure expiresAt is a Date
    if (!otpRecord.expiresAt || !(otpRecord.expiresAt instanceof Date)) {
      // log for debugging
      console.error('[VERIFY-OTP] invalid expiresAt on record:', otpRecord.expiresAt);
      try { await OTP.deleteOne({ _id: otpRecord._id }); } catch (e) {}
      return res.status(400).json({ error: 'Invalid OTP record' });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // check collision (existing user)
    const existingUser = await User.findOne({ $or: [{ email }, { username: otpRecord.username }] });
    if (existingUser) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        error: existingUser.email === email ? 'User with this email already exists' : 'Username is already taken',
      });
    }

    // create user (otpRecord.password is expected to be bcrypt-hashed)
    const user = new User({
      username: otpRecord.username,
      email,
      password: otpRecord.password,
      isVerified: true,
    });
    await user.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: user._id, username: user.username, email: user.email },
      token,
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    next(error);
  }
});

// Resend OTP
app.post('/api/users/resend-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existingOtp = await OTP.findOne({ email });
    if (!existingOtp) return res.status(400).json({ error: 'No registration request found for this email' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    existingOtp.otp = otp;
    existingOtp.expiresAt = expiresAt;
    await existingOtp.save();

    try {
      await sendOTPEmail(email, otp, 'Resent OTP');
      return res.json({ message: 'New OTP sent to your email', email });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Resend OTP error:', error);
    next(error);
  }
});

// ---------------- Password Login ----------------
app.post('/api/users/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    if (!user.isVerified) return res.status(400).json({ error: 'Please verify your email first' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
});

// ---------------- OTP Login (request + verify) ----------------
// Request OTP for login
app.post('/api/users/login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // remove prior OTPs for this email
    await OTP.deleteMany({ email });

    const newOtp = new OTP({
      email,
      otp,
      username: user.username,
      password: 'login-otp', // placeholder
      expiresAt,
    });
    await newOtp.save();

    try {
      await sendOTPEmail(email, otp, 'Login OTP');
      return res.json({ message: 'OTP sent to your email', email });
    } catch (emailError) {
      console.error('Login OTP send failed:', emailError);
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Login OTP error:', error);
    next(error);
  }
});

// Verify login OTP
app.post('/api/users/verify-login-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    let { otp } = req.body;
    if (!email || otp === undefined || otp === null) return res.status(400).json({ error: 'Email and OTP are required' });

    otp = String(otp).trim();

    let otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      const maybeNumber = Number(otp);
      otpRecord = await OTP.findOne({ $or: [{ email, otp }, { email, otp: String(maybeNumber) }, { email, otp: maybeNumber }] });
    }

    if (!otpRecord) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[VERIFY-LOGIN-OTP] OTPs for', email, await OTP.find({ email }).lean());
      }
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (!otpRecord.expiresAt || !(otpRecord.expiresAt instanceof Date) || otpRecord.expiresAt.getTime() < Date.now()) {
      await OTP.deleteOne({ _id: otpRecord._id }).catch(() => {});
      return res.status(400).json({ error: 'OTP has expired or invalid' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await OTP.deleteOne({ _id: otpRecord._id }).catch(() => {});
      return res.status(404).json({ error: 'User not found' });
    }

    await OTP.deleteOne({ _id: otpRecord._id });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ message: 'Login successful', user: { id: user._id, username: user.username, email: user.email }, token });
  } catch (error) {
    console.error('Verify login OTP error:', error);
    next(error);
  }
});


// ---------------- Forgot / Reset Password ----------------
app.post('/api/users/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User with this email does not exist' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ email });

    const newOtp = new OTP({
      email,
      otp,
      username: 'reset',
      password: 'reset',
      expiresAt,
    });
    await newOtp.save();

    try {
      await sendOTPEmail(email, otp, 'Password Reset OTP');
      return res.json({ message: 'Password reset OTP sent to your email', email });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
});

// Reset password (verify OTP + set new password)
app.post('/api/users/reset-password', async (req, res, next) => {
  try {
    let { email, otp, newPassword } = req.body;
    if (!email || otp === undefined || otp === null || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP and new password are required' });
    }

    // Normalize OTP to trimmed string
    otp = String(otp).trim();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[RESET-PASSWORD] incoming', { email, otp, newPasswordProvided: !!newPassword });
    }

    // Find OTP record
    let otpRecord = await OTP.findOne({ email, otp });

    // fallback search if exact match not found (type mismatch)
    if (!otpRecord) {
      const maybeNumber = Number(otp);
      otpRecord = await OTP.findOne({ $or: [{ email, otp }, { email, otp: String(maybeNumber) }, { email, otp: maybeNumber }] });
    }

    if (!otpRecord) {
      if (process.env.NODE_ENV !== 'production') {
        const list = await OTP.find({ email }).lean();
        console.log('[RESET-PASSWORD] OTPs in DB for email:', email, list);
      }
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (!otpRecord.expiresAt || !(otpRecord.expiresAt instanceof Date)) {
      console.error('[RESET-PASSWORD] invalid expiresAt:', otpRecord.expiresAt);
      try { await OTP.deleteOne({ _id: otpRecord._id }); } catch (e) {}
      return res.status(400).json({ error: 'Invalid OTP record' });
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(404).json({ error: 'User not found' });
    }

    // set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ error: error.message, stack: error.stack });
    }
    return next(error);
  }
});


// ---------------- Profile ----------------
app.get('/api/users/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    next(error);
  }
});

// ---------------- Projects ----------------
app.get('/api/projects/:userId', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const project = new Project(req.body);
    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.userId !== req.body.userId) return res.status(403).json({ message: 'Unauthorized' });

    Object.assign(project, req.body);
    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/projects/:id/:userId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.userId !== req.params.userId) return res.status(403).json({ message: 'Unauthorized' });

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ---------------- SEND EMAIL ----------------
app.post('/api/projects/send-email', async (req, res) => {
  try {
    const { toEmail, projectData } = req.body;
    if (!toEmail || !projectData) return res.status(400).json({ message: 'Email and project data required' });

    if (!transporter) {
      console.error('Email transporter is not configured.');
      return res.status(500).json({ message: 'Email transporter not configured' });
    }

    await sendProjectEmail(toEmail, projectData);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Email send failed:', err);
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ message: 'Failed to send email', error: err.message });
    }
    return res.status(500).json({ message: 'Failed to send email' });
  }
});

// ----------------- Global error handler -----------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
    });
  }
  return res.status(err.status || 500).json({ error: 'Internal server error' });
});

// ================== START SERVER ==================
(async function start() {
  await setupTransporter();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
