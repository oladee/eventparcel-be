// import nodemailer from "nodemailer";
// import dotenv from "dotenv";

// dotenv.config();

// async function sendMail(options: string | any) {
//   try {
//     const transporter = nodemailer.createTransport({
//       // service: process.env.MAIL_SERVICE,
//       // auth: {
//       //   user: process.env.MAIL_USER,
//       //   pass: process.env.MAIL_PASS,
//       // },
//     host: process.env.MAIL_SERVICE,
//     port: 465, //587,
//     secure: true,
//     auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASS,
//     },
//     tls: {
//       rejectUnauthorized: false, // Helps with self-signed certificates
//     },
//     });

//     const mailOption = {
//       from: '"Event Parcel Team" <noreply@eventparcel.com>',
//       to: options.email,
//       subject: options.subject,
//       text: options.text,
//       html: options.html,
//       attachments: options.attachments, // Attachments array
//     };

//     await transporter.sendMail(mailOption);
//     return {
//       success: true,
//       message: "Email sent successfully",
//     };
//   } catch (err: unknown) {
//     // Type guard to check if the error is an instance of Error
//     if (err instanceof Error) {
//       console.error("Error sending mail:", err.message);

//       return {
//         success: false,
//         message: "Error sending mail: " + err.message,
//       };
//     }
//   }
// }

// export { sendMail };






import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function sendMailSMTP(options: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_SERVICE,
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: '"Event Parcel Team" <noreply@eventparcel.com>',
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  });
}

async function sendMailAPI(options: any) {
  const response = await axios.post(
    "https://api.zeptomail.com/v1.1/email",
    {
      from: { address: "noreply@eventparcel.com", name: "Event Parcel Team" },
      to: [{ email_address: { address: options.email } }],
      subject: options.subject,
      htmlbody: options.html || "",
    },
    {
      headers: {
        "Accept": "application/json",
        "Authorization": `Zoho-enczapikey ${process.env.MAIL_PASS}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function sendMail(options: any) {
  try {
    // Try API first
    await sendMailAPI(options);
    return { success: true, message: "Email sent via API" };
  } catch (apiError: any) {
    console.warn("API failed, trying SMTP:", apiError.message);
    
    try {
      // Fallback to SMTP
      await sendMailSMTP(options);
      return { success: true, message: "Email sent via SMTP" };
    } catch (smtpError: any) {
      console.error("Both methods failed:", smtpError.message);
      return { success: false, message: smtpError.message };
    }
  }
}

export { sendMail };