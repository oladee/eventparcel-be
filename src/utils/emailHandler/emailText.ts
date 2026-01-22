const generateDynamicEmail = (name: string, link: string) => {

    return `
  

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bookie Pal Verify</title>
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
            width: 100%;
            height: 60px;
            margin-top: 10px;
            object-fit: contain;
        }

        .email-header img {
            width: 180px;
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

        .btn {
            display: inline-block;
            background-color: #1a3783;
            color: #ffffff;
            padding: 10px 20px;
            text-decoration: none;
            font-size: 16px;
            border-radius: 5px;
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

        .email-footer img {
            width: 18px;
            height: 18px;
            object-fit: contain;
        }
    </style>
</head>

<body>
    <div class="email-container">
        <div class="email-header">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1748615993/Event_Parcel_Logo_New_vvdpna.png" alt="event_parcel_Logo">
        </div>
        <div class="email-content">
            <h1>Email Verification</h1>
            <div class="line"></div>
            <p>Hi ${name},</p>
            <p>To confirm your identification, please click the button below to verify your account.</p>
            <a href=${link} class="btn">Verify Account</a>
            <p><small>This link will expire in 30 minutes.</small></p>

            <p>You can only use this link once. If you didn't request this verification email, kindly <a href="https://localhost:8462">contact our
                support team</a>.</p>
            <p>
        </div>
        <div class="email-footer">
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/350974_facebook_logo_icon_zoxrpw.png" alt="LinkedIn"></a>
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725720/twitter-icon_fdawvi.png" alt="Twitter"></a>
                    <a href="#"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/Instagram-PNGinstagram-icon-png_yf4g2j.png" alt="Instagram"></a>
                </p>
                    <p style="color: #333;">&#10084; &nbsp; <strong>Event Parcel</strong></p>
                    <p>Showcase your event souvenirs and fabric patterns in style. <br> Your go-to platform for planning the perfect event look.</p>
                    <p style="color: #333;">Lagos, Nigeria</p>
                    <p><a href="mailto:support@eventparcel.com">support@eventparcel.com</a></p>
        </div>
    </div>
</body>

</html>
  
    `
}

export {generateDynamicEmail};