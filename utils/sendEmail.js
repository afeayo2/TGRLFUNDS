const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'mail.greatfutureinternationalnurseryandprimaryschool.com',
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

module.exports = sendEmail;
