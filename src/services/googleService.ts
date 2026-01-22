import axios from "axios";
import { GoogleContact } from "../interfaces/interface";

export const getGoogleContacts = async (accessToken: string) => {
  const response = await axios.get(
    "https://people.googleapis.com/v1/people/me/connections",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        personFields: 'names,emailAddresses,phoneNumbers',
        pageSize: 1000, // optional: fetch more results
      },
    }
  );

const rawContacts: GoogleContact[] = response.data.connections || [];

const refinedContacts = rawContacts
  .filter((person: GoogleContact) => person.names && person.phoneNumbers) // Ensure both name & number exist
  .map((person: GoogleContact) => ({
    name: person.names?.[0]?.displayName || "Unknown",
    phoneNumber: person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || "No Number",
  }));

  // console.log('Contacts: ', refinedContacts);

  return refinedContacts || []
};
