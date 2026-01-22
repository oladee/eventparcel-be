export const emailInvitePage = (status: string, message: string, buttonText: string, redirectUrl: string) => {
    return `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Parcel</title>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background-color: #f8f9fa;
            margin: 0;
            font-family: Arial, sans-serif;
        }
        .header {
            position: fixed;
            top: 0;
            width: 100%;
            height: 60px;
            background: white;
            padding: 10px 20px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
        }
        .logo img {
            width: 90px;
            margin-left: 20px;
        }
        .nav-links {
            display: flex;
            gap: 20px;
            margin-right: 30px;
        }
        .nav-links a {
            text-decoration: none;
            color: #333;
            font-size: 15px;
            transition: color 0.3s;
        }
        .nav-links a:hover {
            color: #800020;
        }
        .hamburger {
            display: none;
            font-size: 28px;
            cursor: pointer;
            background: none;
            border: none;
            color: #333;
        }
        .mobile-menu {
            display: none;
            flex-direction: column;
            position: absolute;
            top: 60px;
            right: 0;
            background: white;
            width: 200px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            border-radius: 5px;
            padding: 10px;
        }
        .mobile-menu a {
            padding: 10px;
            text-decoration: none;
            color: #333;
            display: block;
            text-align: center;
            transition: background 0.3s;
        }
        .mobile-menu a:hover {
            background: #f0f0f0;
        }
        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }
            .hamburger {
                display: block;
            }
        }
        .container {
            background: #ffffff;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 90%;
            margin-top: 80px;
        }
        .icon {
            width: 70px;
            height: 70px;
            font-size: 30px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 15px;
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
        }
        .message {
            font-size: 15px;
            color: #666;
            margin-top: 8px;
        }
        .button {
            background-color: #800020;
            color: white;
            border: none;
            padding: 15px;
            width: 100%;
            border-radius: 10px;
            font-size: 17px;
            margin-top: 15px;
            cursor: pointer;
        }
        .button:hover {
            background-color: #5a0017;
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="logo">
            <img src="https://res.cloudinary.com/dx6qmw7w9/image/upload/v1748615993/Event_Parcel_Logo_New_vvdpna.png" alt="Logo">
        </div>
        <div class="nav-links">
            <a href="#">Products</a>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">FAQ</a>
        </div>
        <button class="hamburger" id="hamburger">&#9776;</button>
        <div class="mobile-menu" id="mobileMenu">
            <a href="#">Products</a>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">FAQ</a>
        </div>
    </div>

    <div class="container">
        <div id="statusIcon" class="icon"></div>
        <h2 class="title" id="statusTitle"></h2>
        <p class="message" id="statusMessage"></p>
        <button class="button" id="redirectButton"></button>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", function () {
            const hamburger = document.getElementById("hamburger");
            const mobileMenu = document.getElementById("mobileMenu");

            hamburger.addEventListener("click", () => {
                mobileMenu.style.display = mobileMenu.style.display === "flex" ? "none" : "flex";
            });

            document.addEventListener("click", function(event) {
                if (!hamburger.contains(event.target) && !mobileMenu.contains(event.target)) {
                    mobileMenu.style.display = "none";
                }
            });


            // Data injection
            const status = ${JSON.stringify(status)};
            const message = ${JSON.stringify(message)};
            const buttonText = ${JSON.stringify(buttonText)};
            const redirectUrl = ${JSON.stringify(redirectUrl)};

            const successImg = "https://res.cloudinary.com/dl4xukuf1/image/upload/v1741928797/successImg_mwzuwo.png";
            const errorIcon = "❌";

            const statusIconDiv = document.getElementById("statusIcon");
            if (status === "success") {
                const successIcon = document.createElement("img");
                successIcon.src = successImg;
                successIcon.alt = "Success Icon";
                successIcon.style.width = "60px";
                successIcon.style.height = "60px";
                statusIconDiv.appendChild(successIcon);
            } else {
                statusIconDiv.innerHTML = errorIcon;
            }

            document.getElementById("statusTitle").textContent = status === "success" ? "Invite Successful" : "Invite Failed";
            document.getElementById("statusMessage").textContent = message;
            document.getElementById("redirectButton").textContent = buttonText || "Go to Home";

            // Safe redirect URL validation
            const safeRedirectUrl = redirectUrl && redirectUrl.startsWith("http") ? redirectUrl : "https://event-parcel.vercel.app";

            document.getElementById("redirectButton").onclick = function() {
                if (buttonText === "Close") {
                    try {
                        window.close();
                    } catch (err) {
                        console.warn("Window close blocked by browser.");
                    }
                } else {
                    window.location.href = safeRedirectUrl;
                }
            };

            // Auto-close tab after 3 seconds if it's an error
            if (status === "error") {
                let clicked = false;

                document.getElementById("redirectButton").addEventListener("click", function() {
                    clicked = true;
                });

                setTimeout(() => {
                    if (!clicked && buttonText === "Close") {
                        try {
                            window.close();
                        } catch (err) {
                            console.warn("Window close blocked by browser.");
                        }
                    }
                }, 3000);
            }
        });
    </script>

</body>
</html>
    `;
};
