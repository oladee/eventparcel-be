# Event Parcel Server Side Project

## Description
A server side project using NodeJs Typescript Express and MongoDB
This project is a backend application built with Node.js, Express.js, and MongoDB. It provides a RESTful API for Event Parcel.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Database Setup](#database-setup)
- [Technologies Used](#technologies-used)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/DevEben/Event_Parcel_Server.git


2.   Install the dependencies:

    npm install

3.  Create a .env file in the root directory and add the following environment variables:

    -    PORT = your_port_number
    -    DATABASE_URL = your_mongodb_connection_string
    -    SECRET = your_jwt_secret
    -    MAIL_PASS = your_mail_password
    -    MAIL_USER = your_email_address
    -    MAIL_SERVICE = mail_service (e.g: gmail, yahoo, privateemail)
    -    CLOUD_NAME = cloudinary_cloud_name
    -    API_KEY = 6cloudinary_api_key
    -    API_SECRET = cloudinary_api_secret
    -    REDIS_URL = your_redis_url
    -    REDIS_HOST = your_redis_hostname
    -    REDIS_PORT = your_redis_port
    -    REDIS_PASSWORD = your_redis_password


## Usage

To start the server, run the following command:

    npm start


## Database Setup

Make sure you have MongoDB installed and running. Create a database for this project and update the MONGODB_URI as (DATABASE) in the .env file to connect to your MongoDB instance.


## Technologies Used
-    Node.js
-    Express.js
-    Typescript
-    Mongoose
-    JWT for authentication
-    Node.js
-    Bcrypt
-    JSON Web Token (JWT)
-    Nodemailer
-    Nodemon
-    Passport.js


## API Documentation

You can find the API documentation here: https://documenter.getpostman.com/view/31029208/2sAYXBFehY





## Contributing
Contributions are welcome! Please follow these steps:

-    Fork the repository.
-    Create a new branch (git checkout -b feature-branch).
-    Make your changes and commit them (git commit -m 'Add new feature').
-    Push to the branch (git push origin feature-branch).
-    Open a pull request.