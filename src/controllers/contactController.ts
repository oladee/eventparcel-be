import { Request, Response } from "express";
import csv from 'csv-parser';
import { Readable } from 'stream';
import Papa from "papaparse";
import Fuse from 'fuse.js'; // This will now work with CommonJS
import path from "path";
import fs from "fs";
import { AuthenticatedRequest } from "../middleware/authentication";
import { UserService } from "../services/userServices";
import { GuestContactModel, ContactModel } from "../models/contactModel";
import { validateContact } from "../middleware/validator";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { validatePhoneNumber } from "../helpers/helpers";



// const EXPECTED_FIELDS: Record<string, string[]> = {
//   name: ["name", "full name", "first name", "last name", "guest name"],
//   phoneNumber: ["phone number", "phone", "tel", "telephone", "guest phone number"],
// };

// const HEADER_MAP: Record<string, string> = {};

// // Populate HEADER_MAP for easier lookup
// Object.entries(EXPECTED_FIELDS).forEach(([field, synonyms]) => {
//   synonyms.forEach((synonym) => {
//     HEADER_MAP[synonym.toLowerCase()] = field;
//   });
// });

// /**
//  * Finds the best-matching column name using fuzzy matching
//  */
// const findMatchingColumn = (headers: string[], target: string): string | undefined => {
//   return headers.find((col) => fuzzball.ratio(col, target) > 50);
// };

// /**
//  * Normalizes phone numbers by removing the '+' sign if present
//  */
// const normalizePhoneNumber = (phone: string): string => {
//   return phone.startsWith("+") ? phone.slice(1) : phone;
// };

// export const extractCSV = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     if (!req.file) { 
//       console.error("❌ No file uploaded!");
//       return ErrorHandler.badUserInput(res, "No file was uploaded!")
//     }

//     console.log("✅ Uploaded File:", req.file);  // Log uploaded file details

//     const filePath = path.resolve(req.file.path);

//     console.log("Checking file path before reading:", filePath);
//     // Ensure the file exists before proceeding
//     if (!fs.existsSync(filePath)) {
//       console.error("❌ File not found after upload:", filePath);
//       return ErrorHandler.badUserInput(res, "Uploaded CSV file not found.");
//     }

//     // If the file exists, proceed with reading/parsing
//     console.log("✅ File found, proceeding with processing...");

//     // Validate file type & size
//     if (req.file.mimetype !== "text/csv")  {
//       return ErrorHandler.badUserInput(res, "File must be a valid CSV format");
//     }
  
//     if (req.file.size > 5 * 1024 * 1024) {
//       return ErrorHandler.badUserInput(res, "CSV file must not exceed 5MB in size.");
//     }

//     const results: { name: string; phoneNumber: string }[] = [];
//     let parsedHeaders: string[] = [];

//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on("headers", (headers: string[]) => {
//         headers = headers.map((h) => h.toLowerCase());
//         console.log("✅ Parsed Headers:", parsedHeaders);
//       })
//       .on("data", (row: Record<string, any>) => {
//         console.log("📂 Raw Row Data:", row); // Debug raw row data

//         const firstNameColumn = findMatchingColumn(parsedHeaders, "first name");
//         const lastNameColumn = findMatchingColumn(parsedHeaders, "last name");
//         const nameColumn = findMatchingColumn(parsedHeaders, "name");
//         const phoneColumn = findMatchingColumn(parsedHeaders, "phone");

//         console.log("🔍 Matched Columns:", { firstNameColumn, lastNameColumn, nameColumn, phoneColumn });

//         let fullName = "";
//         if (firstNameColumn && lastNameColumn) {
//           fullName = `${row[firstNameColumn]} ${row[lastNameColumn]}`.trim();
//         } else if (nameColumn) {
//           fullName = row[nameColumn].trim();
//         }

//         if (!fullName) return;

//         if (!phoneColumn) return;
//         let phoneNumber = row[phoneColumn];
//         phoneNumber = normalizePhoneNumber(phoneNumber);

//         // Validate phone number
//         const phoneValidationResult = validatePhoneNumber(phoneNumber);
//         if (!phoneValidationResult.success) {
//           return ErrorHandler.badUserInput(res, phoneValidationResult.message, { phoneNumber });
//         }

//         console.log("📞 Extracted Contact:", { fullName, phoneNumber });

//         results.push({ name: fullName, phoneNumber });
//       })
//       .on("end", () => {
//         // Delete file AFTER processing completes
//         if (fs.existsSync(filePath)) {
//           fs.unlinkSync(filePath);
//         }

//         return sendResponse(res, 200, "Contact successfully extracted!", results);
        
//       })
//       .on("error", (err: any) => {
//         console.error("Error parsing CSV:", err);
//         return ErrorHandler.internalServerError(res, "Error parsing CSV");
//       });
//   } catch (error: unknown) {
//     console.error("❌ Error in extractCSV:", error);
//     if (error instanceof Error) {
//       console.error("Server error:", error);
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   } 
// };


// // Define required fields
// const REQUIRED_FIELDS = ["name", "phone"];

// // Function to find best matching column using Fuse.js
// const matchHeaders = async (headers: string[]) => {
//   const Fuse = (await import("fuse.js")).default;
//   const fuse = new Fuse(headers, { threshold: 0.4, keys: [] });

//   return {
//     nameColumn: await findBestMatch(fuse, ["name", "full name", "first name", "last name", "guest name"]),
//     phoneColumn: await findBestMatch(fuse, ["phone number", "phone", "tel", "telephone", "guest phone number"]),
//   };
// };

// // Helper function to get the best match from multiple possible values
// const findBestMatch = async (fuse: any, targets: string[]): Promise<string | undefined> => {
//   for (const target of targets) {
//     const result = fuse.search(target);
//     if (result.length > 0) return result[0].item;
//   }
//   return undefined;
// };

// // Normalize phone number
// const normalizePhoneNumber = (phone: string): string => (phone.startsWith("+") ? phone.slice(1) : phone);

// export const extractCSV = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     if (!req.file) {
//       console.error("❌ No file uploaded!");
//       return ErrorHandler.badUserInput(res, "No file was uploaded!");
//     }

//     console.log("✅ Uploaded File:", req.file);

//     const filePath = path.resolve(req.file.path);
//     if (!fs.existsSync(filePath)) {
//       console.error("❌ File not found after upload:", filePath);
//       return ErrorHandler.badUserInput(res, "Uploaded CSV file not found.");
//     }

//     console.log("✅ File found, proceeding with processing...");

//     // Validate file type & size
//     if (req.file.mimetype !== "text/csv") {
//       return ErrorHandler.badUserInput(res, "File must be a valid CSV format");
//     }
//     if (req.file.size > 5 * 1024 * 1024) {
//       return ErrorHandler.badUserInput(res, "CSV file must not exceed 5MB in size.");
//     }

//     const results: { name: string; phoneNumber: string }[] = [];
//     let parsedHeaders: string[] = [];

//     await new Promise((resolve, reject) => {
//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on("headers", (headers: string[]) => {
//           parsedHeaders = headers.map((h) => h.toLowerCase().trim());
//           console.log("✅ Parsed Headers:", parsedHeaders);
//         })
//         .on("data", async (row: Record<string, any>) => {
//           console.log("📂 Raw Row Data:", row);

//           // Match headers dynamically (ensure async function is awaited)
//           const { nameColumn, phoneColumn } = await matchHeaders(parsedHeaders);
//           console.log("🔍 Matched Columns:", { nameColumn, phoneColumn });

//           if (!nameColumn || !phoneColumn) {
//             console.error("❌ Required columns not found. Skipping row.");
//             return;
//           }

//           let fullName = row[nameColumn]?.trim() || "";
//           if (!fullName) return;

//           let phoneNumber = row[phoneColumn]?.trim() || "";
//           phoneNumber = normalizePhoneNumber(phoneNumber);

//           // Validate phone number
//           const phoneValidationResult = validatePhoneNumber(phoneNumber);
//           if (!phoneValidationResult.success) {
//             console.error("❌ Invalid phone number:", phoneNumber);
//             return;
//           }

//           results.push({ name: fullName, phoneNumber });
//         })
//         .on("end", () => {
//           console.log("✅ Extraction Complete! Results:", results);

//           // Delete file after processing
//           if (fs.existsSync(filePath)) {
//             fs.unlinkSync(filePath);
//           }

//           sendResponse(res, 200, "Contact successfully extracted!", results);
//           resolve(null);
//         })
//         .on("error", (err: any) => {
//           console.error("❌ Error parsing CSV:", err);
//           ErrorHandler.internalServerError(res, "Error parsing CSV");
//           reject(err);
//         });
//     });
//   } catch (error: unknown) {
//     console.error("❌ Error in extractCSV:", error);
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };


// // Normalize phone number
// const normalizePhoneNumber = (phone: string): string =>
//   phone.startsWith("+") ? phone.slice(1) : phone;

// // Match headers dynamically using Fuse.js
// const matchHeaders = async (headers: string[]) => {
//   const Fuse = (await import("fuse.js")).default;
//   const fuse = new Fuse(headers, { threshold: 0.4, keys: [] });

//   return {
//     nameColumn: findBestMatch(fuse, [
//       "name",
//       "full name",
//       "first name",
//       "last name",
//       "guest name",
//     ]),
//     phoneColumn: findBestMatch(fuse, [
//       "phone number",
//       "phone",
//       "tel",
//       "telephone",
//       "guest phone number",
//     ]),
//   };
// };

// // Helper function to get the best match
// const findBestMatch = (fuse: any, targets: string[]): string | undefined => {
//   for (const target of targets.map((t) => t.toLowerCase())) {
//     const result = fuse.search(target);
//     if (result.length > 0) return result[0].item;
//   }
//   return undefined;
// };

// export const extractCSV = async (req: Request, res: Response): Promise<Response | undefined> => {
//   try {
//     if (!req.file) {
//       return ErrorHandler.badUserInput(res, "No file was uploaded!");
//     }

//     console.log("✅ Uploaded File:", req.file);
//     const filePath = path.resolve(req.file.path);

//     if (!fs.existsSync(filePath)) {
//       return ErrorHandler.badUserInput(res, "Uploaded CSV file not found.");
//     }

//     // Read CSV file as text
//     const csvContent = await fs.promises.readFile(filePath, "utf-8");

//     return new Promise((resolve) => {
//       Papa.parse(csvContent, {
//         header: true, // Treat first row as headers
//         skipEmptyLines: true,
//         step: (row) => {  // Use `step` to log each row as it's processed
//           console.log("Row Data:", row.data);
//         },
//         complete: async (result) => {
//           console.log("✅ Parsed CSV Headers:", result.meta.fields);

//           if (!result.meta.fields) {
//             return resolve(ErrorHandler.badUserInput(res, "CSV headers could not be determined."));
//           }

//           const parsedHeaders = result.meta.fields.map((h) => h.toLowerCase().trim());
//           const matchedColumns = await matchHeaders(parsedHeaders);

//           const { nameColumn, phoneColumn } = matchedColumns;
//           console.log("🔍 Matched Columns:", { nameColumn, phoneColumn });

//           if (!nameColumn || !phoneColumn) {
//             return resolve(ErrorHandler.badUserInput(res, "Required columns (Name, Phone) not found."));
//           }

//           // Extract valid data
//           const results = result.data
//             .map((row: any) => {
//               const fullName = row[nameColumn]?.trim() || "";
//               let phoneNumber = row[phoneColumn]?.trim() || "";

//               if (!fullName || !phoneNumber) return null;

//               phoneNumber = normalizePhoneNumber(phoneNumber);
//               return { name: fullName, phoneNumber };
//             })
//             .filter(Boolean); // Remove null entries

//           console.log("✅ Extraction Complete! Results:", results);

//           // Cleanup: Remove uploaded file
//           await fs.promises.unlink(filePath);

//           resolve(res.status(200).json({ message: "Contacts successfully extracted!", data: results }));
//         },
//         error: (err: any) => {
//           console.error("❌ Error parsing CSV:", err);
//           resolve(ErrorHandler.internalServerError(res, "Error parsing CSV"));
//         },
//       });
//     });
//   } catch (error: unknown) {
//     console.error("❌ Error in extractCSV:", error);
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//   }
// };




// // Normalize phone number
// const normalizePhoneNumber = (phone: string): string =>
//   phone.startsWith("+") ? phone.slice(1) : phone;

// // Match headers dynamically using Fuse.js
// const matchHeaders = (headers: string[]) => {
//   const fuse = new Fuse(headers, { threshold: 0.4, keys: [] });

//   return {
//     nameColumn: findBestMatch(fuse, [
//       "name",
//       "full name",
//       "first name",
//       "last name",
//       "guest name",
//     ]),
//     phoneColumn: findBestMatch(fuse, [
//       "phone number",
//       "phone",
//       "tel",
//       "telephone",
//       "guest phone number",
//     ]),
//   };
// };

// // Helper function to get the best match
// const findBestMatch = (fuse: any, targets: string[]): string | undefined => {
//   for (const target of targets.map((t) => t.toLowerCase())) {
//     const result = fuse.search(target);
//     if (result.length > 0) return result[0].item;
//   }
//   return undefined;
// };

// export const extractCSV = async (req: Request, res: Response): Promise<Response | undefined> => {
//   let filePath: string | undefined;

//   try {
//     if (!req.file) {
//       return ErrorHandler.badUserInput(res, "No file was uploaded!");
//     }

//     console.log("✅ Uploaded File:", req.file);
//     filePath = path.resolve(req.file.path);

//     if (!fs.existsSync(filePath)) {
//       return ErrorHandler.badUserInput(res, "Uploaded CSV file not found.");
//     }

//     // Read CSV file as text
//     const csvContent = await fs.promises.readFile(filePath, "utf-8");
//     console.log("Raw CSV Content:", csvContent); // Debugging: Log raw CSV content

//     const parsedResults: any = await new Promise((resolve, reject) => {
//       Papa.parse(csvContent, {
//         header: true, // Treat first row as headers
//         skipEmptyLines: true,
//         transformHeader: (header) => header.trim(), // Ensure headers are trimmed
//         complete: (result) => {
//           console.log("✅ Parsed CSV Headers:", result.meta.fields);
//           console.log("✅ Parsed CSV Data:", result.data); // Log all rows after parsing
//           resolve(result);
//         },
//         error: (err: any) => {
//           console.error("❌ Error parsing CSV:", err);
//           reject(err);
//         },
//       });
//     });

//     if (!parsedResults.meta.fields) {
//       return ErrorHandler.badUserInput(res, "CSV headers could not be determined.");
//     }

//     const parsedHeaders = parsedResults.meta.fields.map((h: string) => h.toLowerCase().trim());
//     const matchedColumns = matchHeaders(parsedHeaders); // No need for `await`

//     const { nameColumn, phoneColumn } = matchedColumns;
//     console.log("🔍 Matched Columns:", { nameColumn, phoneColumn });

//     if (!nameColumn || !phoneColumn) {
//       return ErrorHandler.badUserInput(res, "Required columns (Name, Phone) not found.");
//     }

//     // Extract valid data
//     const results = parsedResults.data
//       .map((row: any) => {
//         const fullName = row[nameColumn]?.trim() || "";
//         let phoneNumber = row[phoneColumn]?.trim() || "";

//         if (!fullName || !phoneNumber) return null;

//         phoneNumber = normalizePhoneNumber(phoneNumber);
//         return { name: fullName, phoneNumber };
//       })
//       .filter(Boolean); // Remove null entries

//     console.log("✅ Extraction Complete! Results:", results);

//     return res.status(200).json({ message: "Contacts successfully extracted!", data: results });
//   } catch (error: unknown) {
//     console.error("❌ Error in extractCSV:", error);
//     if (error instanceof Error) {
//       return ErrorHandler.internalServerError(res, error.message);
//     }
//     return ErrorHandler.internalServerError(res, "An unknown error occurred.");
//   } finally {
//     // Cleanup: Remove uploaded file
//     if (filePath && fs.existsSync(filePath)) {
//       try {
//         await fs.promises.unlink(filePath);
//         console.log("✅ Uploaded file cleaned up:", filePath);
//       } catch (cleanupError) {
//         console.error("❌ Error cleaning up file:", cleanupError);
//       }
//     }
//   }
// };


// Normalize phone number
const normalizePhoneNumber = (phone: string): string =>
  phone.startsWith("+") ? phone.slice(1) : phone;

const possibleNameColumns = ["first name", "guest name", "full name", "name"];
const possiblePhoneColumns = [
  "phone 1 - value",
  "guest phone number",
  "phone number",
  "tel",
  "telephone",
];

// Match headers dynamically
const matchHeaders = (headers: string[]) => {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const findColumn = (targets: string[]) =>
    lowerHeaders.find((header) =>
      targets.some((target) => header.includes(target.toLowerCase()))
    );

  return {
    nameColumn: findColumn(["name", "full name", "first name", "last name", "guest name"]),
    phoneColumn: findColumn(["phone number", "phone", "tel", "telephone", "guest phone number", "Phone 1 - Value"]),
  };
};

export const extractCSV = async (req: Request, res: Response): Promise<Response | undefined> => {
  let filePath: string | undefined;

  try {
    if (!req.file) {
      return ErrorHandler.badUserInput(res, "No file was uploaded!");
    }

    console.log("✅ Uploaded File:", req.file);
    filePath = path.resolve(req.file.path);

    if (!fs.existsSync(filePath)) {
      return ErrorHandler.badUserInput(res, "Uploaded CSV file not found.");
    }

    // Validate file type & size
    if (req.file.mimetype !== "text/csv")  {
      return ErrorHandler.badUserInput(res, "File must be a valid CSV format");
    }
  
    if (req.file.size > 5 * 1024 * 1024) {
      return ErrorHandler.badUserInput(res, "CSV file must not exceed 5MB in size.");
    }

    // Read CSV file as text
    const csvContent = await fs.promises.readFile(filePath, "utf-8");
    // console.log("Raw CSV Content:", csvContent); // Debugging: Log raw CSV content

    const parsedResults: any = await new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true, // Treat first row as headers
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(), // Ensure headers are trimmed
        complete: (result) => {
          console.log("✅ Parsed CSV Headers:", result.meta.fields);
          // console.log("✅ Parsed CSV Data:", result.data); // Log all rows after parsing
          resolve(result);
        },
        error: (err: any) => {
          console.error("❌ Error parsing CSV:", err);
          reject(err);
        },
      });
    });

    if (!parsedResults.meta.fields) {
      return ErrorHandler.badUserInput(res, "CSV headers could not be determined.");
    }

    const parsedHeaders = parsedResults.meta.fields.map((h: string) => h.toLowerCase().trim());
    const matchedColumns = matchHeaders(parsedHeaders);

    const { nameColumn, phoneColumn } = matchedColumns;
    console.log("🔍 Matched Columns:", { nameColumn, phoneColumn });

    // if (!nameColumn || !phoneColumn) {
    //   return ErrorHandler.badUserInput(res, "Required columns (Name, Phone) not found.");
    // }
    if (!nameColumn || !phoneColumn) {
  return ErrorHandler.badUserInput(
    res,
    `Your CSV file is missing required columns. Please make sure it includes 'Name' and 'Phone Number' as column headers.\n\nDetected columns: ${parsedHeaders.join(", ")}`
  );
}

    // Extract valid data
    // const results = parsedResults.data.map((row: any) => {
    //   const rowKeys = Object.keys(row).reduce((acc, key) => {
    //     acc[key.toLowerCase().trim()] = row[key]; // Normalize keys
    //     return acc;
    //   }, {} as Record<string, string>);
    
    //   // Check for multiple possible column names
    //   const firstName =
    //     rowKeys["first name"] || rowKeys["guest name"]
    //       ? (rowKeys["first name"] || rowKeys["guest name"]).trim()
    //       : "";
    
    //   let phoneNumber =
    //     rowKeys["phone 1 - value"] || rowKeys["guest phone number"]
    //       ? (rowKeys["phone 1 - value"] || rowKeys["guest phone number"]).trim()
    //       : "";
    
    //   if (!firstName || !phoneNumber) return null;
    
    //   phoneNumber = normalizePhoneNumber(phoneNumber); // Ensure proper phone format
    //   return { name: firstName, phoneNumber };
    // }).filter(Boolean); // Remove null entries
    
    // console.log("✅ Extraction Complete! Results:", results);

    const results = parsedResults.data.map((row: any) => {
      const rowKeys = Object.keys(row).reduce((acc, key) => {
        acc[key.toLowerCase().trim()] = row[key]; // Normalize keys
        return acc;
      }, {} as Record<string, string>);
    
      // Find the first available name column
      const firstName = possibleNameColumns.find((col) => rowKeys[col]) 
        ? rowKeys[possibleNameColumns.find((col) => rowKeys[col])!].trim() 
        : "";
    
      // Find the first available phone column
      let phoneNumber = possiblePhoneColumns.find((col) => rowKeys[col]) 
        ? rowKeys[possiblePhoneColumns.find((col) => rowKeys[col])!].trim() 
        : "";
    
      if (!firstName || !phoneNumber) return null;
    
      phoneNumber = normalizePhoneNumber(phoneNumber); // Ensure proper phone format
      return { name: firstName, phoneNumber };
    }).filter(Boolean); // Remove null entries
    
    console.log("✅ Extraction Complete! Results!");

    if (results.length === 0) {
      return ErrorHandler.notFound(res, "Extracted CSV file empty or invalid CSV template")
    }
    

    return sendResponse(res, 200, "Contacts successfully extracted!", results);
    // return res.status(200).json({ message: "Contacts successfully extracted!", data: results });
  } catch (error: unknown) {
    console.error("❌ Error in extractCSV:", error);
    if (error instanceof Error) {
      return ErrorHandler.internalServerError(res, error.message);
    }
    return ErrorHandler.internalServerError(res, "An unknown error occurred.");
  } finally {
    // Cleanup: Remove uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
        console.log("✅ Uploaded file cleaned up:", filePath);
      } catch (cleanupError) {
        console.error("❌ Error cleaning up file:", cleanupError);
      }
    }
  }
};





// Function to save extracted/selected contacts
export const saveExtractedContacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { error } = validateContact(req.body);
    if (error) {
      return ErrorHandler.badUserInput(res, error.details[0].message);
    }
    const userId = req.user?.userId; // Get authenticated user ID

    if (!userId) {
      return ErrorHandler.unauthorized(res, "User authentication required.");
    }

    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return ErrorHandler.badUserInput(res, "Invalid request! Contacts array is required.");
    }

    // Format contacts by adding userId
    const formattedContacts = contacts.map(contact => ({
      userId,
      guestName: contact.guestName,
      guestPhoneNumber: contact.guestPhoneNumber,
    }));

    // Save contacts in bulk
    const guestContacts = await GuestContactModel.insertMany(formattedContacts);

    // save inside the user contact data 
    const savedContacts = await ContactModel.create({
      user: userId,
      contacts: guestContacts,
    })

    return res.status(201).json({
      success: true,
      message: "Contacts saved successfully!",
      data: savedContacts,
    });
  } catch (error) {
    console.error("❌ Error saving contacts:", error);
    return ErrorHandler.internalServerError(res, "Error saving contacts.");
  }
};