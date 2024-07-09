const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// exports.sendPasswordResetEmail = async (to, token) => {
//   console.log('Sending reset email with token:', token);

//   //const resetLink = `${process.env.NGROK_URL || process.env.FRONTEND_URL}/reset-password/${token}`;
//   // const resetLink = `${process.env.NGROK_URL}/reset-password/${token}`;

//    // Log Ngrok URL usage and generate reset link
//    console.log('Using Ngrok URL:', process.env.NGROK_URL);
//    const resetLink = `${process.env.NGROK_URL}/reset-password/${token}`;


//    console.log('Generated Reset Link:', resetLink);

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: to,
//     subject: 'Password Reset',
//     text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
//            Please click on the following link, or paste this into your browser to complete the process:\n\n
//            ${resetLink}\n\n
//            If you did not request this, please ignore this email and your password will remain unchanged.\n`
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log('Password reset email sent');
//   } catch (error) {
//     console.error('Error sending password reset email:', error);
//     throw error;
//   }
// };


exports.sendPasswordResetEmail = async (to, resetPath) => {
  console.log('Sending reset email with path:', resetPath);
  
  const resetLink = `${process.env.NGROK_URL}${resetPath}`;
  
  console.log('Generated Reset Link:', resetLink);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: 'Password Reset',
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
           Please click on the following link, or paste this into your browser to complete the process:\n\n
           ${resetLink}\n\n
           If you did not request this, please ignore this email and your password will remain unchanged.\n`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent');
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};