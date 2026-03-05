
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.us.appsuite.cloud",
  port: 465,
  secure: true, // Use SSL for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"TrustGolden" ${process.env.EMAIL_USER}`,
      to,
      subject,
      html,
    });
  } catch (error) {
    throw new Error("Error sending mail");
  }
};

module.exports = sendEmail;








/*
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'mail.trustgolden@topteck.com.ng',
  port: 465,
  secure: true,
  auth: {
    user: process.env.CPANEL_EMAIL,
    pass: process.env.CPANEL_EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // This disables certificate validation
  }
});

const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: `"TrustGolden" <${process.env.CPANEL_EMAIL}>`,
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};
*/
//module.exports = sendEmail;
