
const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date
  });
  
  module.exports = mongoose.model('User', userSchema);
