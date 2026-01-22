const resetFunc = (email: string, link: string) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <title>Password Reset</title>
        <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">
        <style>
            body {
                margin: 0; 
                padding: 0 !important; 
                background-color: #fafafa6d; 
                font-family: 'Lato', sans-serif;
            }
            .container {
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #ffffff; 
                border-radius: 10px; 
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center; 
                padding: 2em 0;
            }
            .header img {
                width: 250px; 
                height: auto; 
            }
            .content {
                padding: 2em;
                text-align: center;
                color: rgba(0, 0, 0, .6);
            }
            .content h2 {
                font-size: 40px; 
                margin-bottom: 0; 
                font-weight: 400;
            }
            .content h3 {
                font-size: 24px; 
                font-weight: 300;
            }
            .btn {
                padding: 15px 35px; 
                border-radius: 3px; 
                background: #ed7f06; 
                color: #ffffff; 
                text-decoration: none; 
                font-size: 20px; 
                font-weight: 500;
            }
            .footer {
                background-color: #fafafa; 
                text-align: center; 
                padding: 20px 0;
            }
            .social-icons img {
                width: 20px; 
                height: 20px; 
                margin: 0 5px;
            }
        </style>
    </head>
    <body>
        <center style="width: 100%;">
            <div class="container">
                <div class="header">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1748615993/Event_Parcel_Logo_New_vvdpna.png" alt="event_parcel_Logo">
                </div>
                <div class="content">
                    <h2>Please Reset Your Password</h2>
                    <h3>Dear ${email},</h3>
                    <p>Below is a link to reset your password.</p>
                    <p><a href="${link}" class="btn">Reset Password</a></p>
                    <h6>This email expires in 15 minutes</h6>
                </div>
                <div class="footer">
                    <div class="social-icons">
                        <a href="https://twitter.com/your_username" target="_blank"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725720/twitter-icon_fdawvi.png" alt="Twitter"></a>
                        <a href="https://facebook.com/your_username" target="_blank"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/350974_facebook_logo_icon_zoxrpw.png" alt="Facebook"></a>
                        <a href="https://instagram.com/your_username" target="_blank"><img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1705725721/Instagram-PNGinstagram-icon-png_yf4g2j.png" alt="Instagram"></a>
                    </div>
                    <p style="color: #333;">&#10084; &nbsp; <strong>Event Parcel</strong></p>
                    <p>Showcase your event souvenirs and fabric patterns in style. <br> Your go-to platform for planning the perfect event look.</p>
                    <p style="color: #333;">Lagos, Nigeria</p>
                    <p><a href="mailto:support@eventparcel.com">support@eventparcel.com</a></p>
                    <p>© Copyright ${new Date().getFullYear()}. All rights reserved.</p>
                </div>
            </div>
        </center>
    </body>
    </html>
    `;
};

export { resetFunc };
