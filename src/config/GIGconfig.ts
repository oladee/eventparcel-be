import axios from "axios";

const ENV = process.env.NODE_ENV || "development";

const BASE_URL =
  ENV === "production"
    ? "https://prod-agilitythirdpartyapi.theagilitysystems.com/api/ThirdParty"
    : "https://dev-agilitythirdpartyapi.theagilitysystems.com/api/thirdparty";

    // "https://dev-agilitythirdpartyapi.theagilitysystems.com/api/thirdparty"
    //"https://giglthirdpartyapitestenv.azurewebsites.net/api/thirdparty"


const GIGinstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// DEV login credentials
// const devCredentials = {
//   username: "ECO001449",
//   password: "1234567",
//   SessionObj: "",
// };

const devCredentials = {
  username: "testaccount@yahoo.com",
  password: "loving",
  sessionObj: "string"
}

const prodCredentials = {
  username: process.env.GIG_USERNAME,
  password: process.env.GIG_PASSWORD,
  sessionObj: process.env.GIG_SESSIONOBJ,
}

// Function to set the credentials dynamically based on the environment
const setCredentials = () => {
  if (ENV === "production") {
    return prodCredentials;
  } else {
    return devCredentials;
  }
};

// Call the function to set the credentials
const credentials = setCredentials();

export { GIGinstance, BASE_URL, credentials };
