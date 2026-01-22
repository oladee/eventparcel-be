import nodemailer from "nodemailer";

// Set up nodemailer transporter (using Gmail as an example)
const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE as string,
  auth: {
    user: process.env.MAIL_USER as string,
    pass: process.env.MAIL_PASS as string,
  },
});

// Send email notification
const sendEmailNotification = async (
  email: string,
  subject: string,
  message: string
) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: subject,
      // text: message,
      html: `<p>${message}</p>`, // HTML body
    });

    console.log(`Email sent to ${email} with subject: ${subject}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to send email to ${email}:`, error.message);
    }
  }
};

export { sendEmailNotification };
