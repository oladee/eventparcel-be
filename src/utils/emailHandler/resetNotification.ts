const resetNotification = (firstName: string, otp: string) => {
    return `
    <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Notification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
        }

        .email-container {
            max-width: 500px;
            background-color: #ffffff;
            border: 1px solid #ddd;
        }

        .email-header {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 10px;
        }

        .email-header img {
            width: 150px;
            height: auto;
        }

        .email-content {
            background-color: white;
            text-align: left;
            color: #333;
            padding: 20px;
        }

        .email-content h1 {
            color: #1a3783;
            font-size: 24px;
        }

        .email-content p {
            font-size: 16px;
            margin: 20px 0;
        }

        .line {
            border-bottom: 1.5px solid #ccc;
            width: 100%;
        }

        .email-footer {
            text-align: center;
            padding: 10px 10px;
            font-size: 14px;
            color: #888;
            background-color: #f0efef;
        }

        .email-footer a {
            color: #500050;
            text-decoration: none;
        }
    </style>
</head>

<body>
 <center style="width: 100%;">
    <div class="email-container">
        <div class="email-header">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1748615993/Event_Parcel_Logo_New_vvdpna.png" alt="event_parcel_Logo">
        </div>
        <div class="email-content">
            <h1>Reset Password Notification</h1>
            <div class="line"></div>
            <p>Hi ${firstName},</p>
            <p>Below is your One Time Password (OTP) to reset your password.</p>
            <p>Your new OTP is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 15 minutes. Please use it to verify your account.</p>
        </div>
        <div class="email-footer">
                <p style="color: #333;">&#10084; &nbsp; <strong>Event Parcel</strong></p>
                <p>Showcase your event souvenirs and fabric patterns in style. <br> Your go-to platform for planning the perfect event look.</p>
                <p style="color: #333;">Lagos, Nigeria</p>
                <p><a href="mailto:support@eventparcel.com">support@eventparcel.com</a></p>
        </div>
    </div>
    </center>
</body>

</html>
    `;
};

export { resetNotification };
