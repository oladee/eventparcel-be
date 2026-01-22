const generateLoginOTP = (firstName: string, otp: string, link: string) => {
    return `
    <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Notification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .email-container {
            max-width: 500px;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .email-header {
            background-color: #ffffff;
            padding: 20px;
            text-align: center;
        }

        .email-header img {
            width: 150px;
            height: auto;
        }

        .email-content {
            padding: 20px;
            color: #333;
            text-align: left;
        }

        .email-content h1 {
            color: #751423;
            font-size: 22px;
            margin-bottom: 10px;
        }

        .line {
            border-bottom: 2px solid #751423;
            width: 100%;
            margin-bottom: 15px;
        }

        .email-content p {
            font-size: 16px;
            margin: 10px 0;
        }

        .otp {
            font-size: 18px;
            font-weight: bold;
            color: #751423;
        }

        .btn {
            display: inline-block;
            background-color: #751423;
            color: #ffffff;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }

        .btn:hover {
            background-color: #5c101c;
        }

        .email-footer {
            text-align: center;
            padding: 15px;
            font-size: 14px;
            color: #fff;
            background-color: #751423;
        }

        .email-footer a {
            color: #ffcccb;
            text-decoration: none;
        }
    </style>
</head>

<body>
    <center style="width: 100%;">
        <div class="email-container">
            <div class="email-header">
                <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1748615993/Event_Parcel_Logo_New_vvdpna.png" alt="Event Parcel Logo">
            </div>
            <div class="email-content">
                <h1>Login Notification</h1>
                <div class="line"></div>
                <p>Hi ${firstName},</p>
                <p>Enter this OTP on the verification page to continue your login:</p>
                <p class="otp">OTP: ${otp}</p>
                <p><strong>OR</strong></p>
                <p>Verify your email through the link below:</p>
                <a href=${link} class="btn">Verify Email</a>
                <p><small>This link will expire in 30 minutes.</small></p>
                <p>If this was not you, please contact our support team immediately.</p>
            </div>
            <div class="email-footer">
                <p>&#10084; &nbsp; <strong>Event Parcel</strong></p>
                <p>Showcase your event souvenirs and fabric patterns in style.<br>Your go-to platform for planning the perfect event look.</p>
                <p>Lagos, Nigeria</p>
                <p><a href="mailto:support@eventparcel.com">support@eventparcel.com</a></p>
            </div>
        </div>
    </center>
</body>

</html>
    `;
};

export { generateLoginOTP };
