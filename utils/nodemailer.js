import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create a transporter object
var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    service: "gmail",
    port: 587,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASSWORD, 
    },
});

// Confirming server ready for taking emails
transporter.verify((error, success) => {
    if (error) {
        console.log("Error in verify: ", error);
    } else {
        console.log('Server is ready to take messages');
    }
});

// Function to send an email
const sendEmail = async (mailOptions) => {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

export default sendEmail;
