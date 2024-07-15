
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const ngrok = require('ngrok');
const crypto = require('crypto');
const emailService = require('./services/emailService');

// Set up the server
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const NGROK_URL = process.env.NGROK_URL;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set. Please set it in your environment variables.');
  process.exit(1);
}
if (!NGROK_URL) {
  console.error('NGROK_URL is not set. Please set it in your environment variables.');
  process.exit(1);
}

const cors = require('cors');
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.NGROK_URL],
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Elections', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('CONNECTED SUCCESSFULLY TO MONGODB');
  }).catch((err) => {
    console.error('MongoDB connection ERROR:', err);
    process.exit(1);
  });
console.log('Registered models:', Object.keys(mongoose.models));

// Basic route
app.get('/', (req, res) => {
  console.log("This is the server page");
  res.send('Welcome To Our Server :)')
});

app.post('/api/signup', async (req, res) => {
    const { username, password, email } = req.body;
  
    try {
      // Check if the user already exists
      let existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user instance
      const newUser = new User({
        username,
        password: hashedPassword,
        email,
      });
  
      // Save the user to the database
      await newUser.save().then(savedUser => {
        console.log('User saved successfully:', savedUser)
      })
      .catch(err =>{
        console.log('Error saving user:', err)
        throw err
      });
  
      // Generate a JWT token for the newly registered user
      const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
  
      // Respond with token or any other response as needed
      res.status(201).json({ message: 'User registered successfully', token });
  
    } catch (error) {
      console.error('Error in signup route: ', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

// Route to handle user login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    //check if account is locked
    if(user.lockUntil && user.lockUntil > Date.now()){
      return res.status(403).json({message: "Your account is locked. Please reset your password."})
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.loginAttempts += 1;
      await user.save();

      if (user.loginAttempts >= 5) {
        // Lock the account and send reset email
        user.lockUntil = Date.now() + 3600000; // Lock for 1 hour
        await user.save();

        // Generate reset token
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send reset email
        const resetLink = `${process.env.NGROK_URL}/reset-password/${token}`;
        await emailService.sendPasswordResetEmail(user.email, resetLink);

        return res.status(403).json({ message: 'Too many failed attempts. A password reset email has been sent.' });
      }

      return res.status(401).json({ message: 'Invalid credentials', attemptsLeft: 5 - user.loginAttempts });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  
    // Create JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    //log success message to the server terminal for us to see
    console.log(`The user: ${username} was able to log in successfully!`)

    // Respond with token
    res.json({ 
      message: "You were logged in successfully!",
      token: token,
      success: true,
      username: user.username,
    })
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', success: false });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000 * 24; // 24 hours

    await user.save();
    console.log('uSER AFTER SAVE:', user)

    // Remove NGROK_URL from here
    const resetLink = `/reset-password/${token}`;
    await emailService.sendPasswordResetEmail(user.email, resetLink);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error in forgot-password route:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  console.log('Received reset request with token:', token);
  res.send(`
    <form action="/api/reset-password/${token}" method="POST">
      <input type="password" name="password" placeholder="New password" required>
      <button type="submit">Reset Password</button>
    </form>
  `);
});

app.post('/api/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  console.log(`Received reset request with token:`, req.params.token);

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('Invalid or expired token:', token);
      return res.status(400).json({ message: 'The password reset link is invalid. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    console.log('User after password reset:', user)

    res.json({ message: 'Password has been reset' });
  } catch (error) {
    console.error('Error in reset password route:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const path = require('path');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  if (process.env.NODE_ENV === 'development') {
    try {
      const ngrokUrl = await ngrok.connect({
        addr: PORT,
        authtoken: process.env.NGROK_AUTHTOKEN
      });
      console.log(`ngrok tunnel created: ${ngrokUrl}`);
      process.env.NGROK_URL = ngrokUrl;
    } catch (err) {
      console.error('Error creating ngrok tunnel:', err);
      console.log('Server is still running locally without ngrok.');
    }
  }
});


