export const generateCoHostInvitationEmail = (
    coHostName: string,
    hostName: string,
    eventName: string,
    acceptUrl: string,
    declineUrl: string
  ) => {
    return `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoHost Invitation</title>
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
            border-radius: 8px;
            overflow: hidden;
        }

        .email-header {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 15px;
            background-color: #fcfcfc;
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
            font-size: 24px;
        }

        .email-content p {
            font-size: 16px;
            margin: 15px 0;
        }

        .button-container {
            text-align: center;
            margin: 25px 0;
        }

        .button {
            display: inline-block;
            padding: 12px 20px;
            font-size: 16px;
            font-weight: bold;
            text-decoration: none;
            color: #ffffff;
            border-radius: 5px;
            margin: 5px;
        }

        .accept-button {
            color: #ffffff;
            background-color: #28a745;
        }

        .decline-button {
            color: #ffffff;
            background-color: #dc3545;
        }

        .email-footer {
            text-align: center;
            padding: 15px;
            font-size: 14px;
            color: #fff;
            background-color: #751423;
        }

        .email-footer a {
            color: #ffdada;
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
            <h1>You're Invited to CoHost!</h1>
            <p>Dear ${coHostName},</p>
            <p>You have been invited by <strong>${hostName}</strong> to collaborate on activities relating to their upcoming event "<strong>${eventName}</strong>".</p>
            <p>You can accept/decline this invitation using the actions below.</p>
            <div class="button-container">
                <a href="${acceptUrl}" class="button accept-button" style="color: #ffffff;">Accept Invitation</a>
                <a href="${declineUrl}" class="button decline-button" style="color: #ffffff;">Decline Invitation</a>
            </div>
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
        </div>
        <div class="email-footer">
                <p style="color: #fff;">&#10084; &nbsp; <strong>Event Parcel</strong></p>
                <p>Showcase your event souvenirs and fabric patterns in style. <br> Your go-to platform for planning the perfect event look.</p>
                <p style="color: #fff;">Lagos, Nigeria</p>
                <p><a href="mailto:support@eventparcel.com">support@eventparcel.com</a></p>
        </div>
    </div>
    </center>
</body>

</html>
    `;
  };
  