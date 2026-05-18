import Joi, { ObjectSchema, ValidationResult } from "@hapi/joi";
import mongoose from "mongoose";
import { IContact, IEvent, IEventGroup, IPackage, INairaPayout, IDollarPayout, IPaymentAndDelivery, IDiscount, IOrder } from '../interfaces/modelInterface';

interface UserData {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface ResetPasswordData {
  email?: string;
  password: string;
  confirmPassword: string;
}


// Custom validation function for coordinates
const validateCoordinate = (value: string, helpers: Joi.CustomHelpers<string>) => {
  // Handle empty string case (from .empty(''))
  if (value === '') {
    return value;
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return helpers.error('number.base');
  }

  const isLatitude = helpers.state.path?.includes('Latitude') ?? false;
  const min = isLatitude ? -90 : -180;
  const max = isLatitude ? 90 : 180;

  if (num < min || num > max) {
    return helpers.error('number.range', { min, max });
  }

  return value;
};


const validateU = (data: UserData): ValidationResult => {
  const userValidationSchema: ObjectSchema<UserData> = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Password field can't be left empty",
      }),
    confirmPassword: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Confirm Password field can't be left empty",
      }),
  });

  return userValidationSchema.validate(data, { abortEarly: false });
};

const validateUser = (data: UserData): ValidationResult => {
  const userValidationSchema: ObjectSchema<UserData> = Joi.object({
    firstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "First Name must be at least 2 characters long",
      "string.pattern.base": "First Name must contain only letters",
    }),
    lastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "lastName must be at least 2 characters long",
      "string.pattern.base": "Last Name must contain only letters",
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    phoneNumber: Joi.string()
      .allow(null, ""),
    temporaryUserId: Joi.string().min(3).optional(),
    password: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password must not exceed 20 characters",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Password field can't be left empty",
      }),
    confirmPassword: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Confirm Password field can't be left empty",
      }),
  });

  return userValidationSchema.validate(data, { abortEarly: false });
};


const validateAdmin = (data: UserData): ValidationResult => {
  const userValidationSchema: ObjectSchema<UserData> = Joi.object({
    firstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "First Name must be at least 2 characters long",
      "string.pattern.base": "First Name must contain only letters",
    }),
    lastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "lastName must be at least 2 characters long",
      "string.pattern.base": "Last Name must contain only letters",
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    role: Joi.string().valid("superAdmin", "admin").required().messages({
      "any.only": "Role must be either 'superAdmin' or 'admin'",
      "any.required": "Role is required",
    }),
    password: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .optional()
      .empty("")
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password must not exceed 20 characters",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
      }),
  });

  return userValidationSchema.validate(data, { abortEarly: false });
};


const validateEmail = (data: { email: string }): ValidationResult => {
  const validateSchema: ObjectSchema<{ email: string }> = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  });

  return validateSchema.validate(data, { abortEarly: false });
};

const validateResetPassword = (data: ResetPasswordData): ValidationResult => {
  const validateSchema: ObjectSchema<ResetPasswordData> = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).messages({
      "string.email": "Please provide a valid email address",
    }),
    currentPassword: Joi.string().optional().empty(""),
    password: Joi.string()
      .min(8)
      .max(20)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .required()
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password must not exceed 20 characters",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Password field can't be left empty",
      }),
    confirmPassword: Joi.string()
      .min(8)
      .max(20)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .required()
      .messages({
        "string.min": "Confirm Password must be at least 8 characters long",
        "string.max": "Confirm Password must not exceed 20 characters",
        "string.pattern.base":
          "Confirm Password must contain lowercase, uppercase, numbers, and special characters",
        "any.required": "Confirm Password field can't be left empty",
      }),
  }).custom((data, helpers) => {
    if (data.password !== data.confirmPassword) {
      return helpers.message({
        custom: "Password and Confirm Password must match",
      });
    }
    return data;
  });

  return validateSchema.validate(data, { abortEarly: false });
};

const validateUpdatedUser = (data: UserData): ValidationResult => {
  const userValidationSchema: ObjectSchema<UserData> = Joi.object({
    firstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "First name must be at least 2 characters long",
      "any.required": "First name is required",
      "string.pattern.base": "First Name must contain only letters",
    }),
    lastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "Last name must be at least 2 characters long",
      "any.required": "Last name is required",
      "string.pattern.base": "Last Name must contain only letters",
    }),
    email: Joi.string().email({ tlds: { allow: false } }).messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    phoneNumber: Joi.string()
      .pattern(/^(?:0|\+?234)(7[0-9]|8[0-9]|9[0-9])[0-9]{7,8}$/)
      .allow(null, "")
      .messages({
        "string.pattern.base":
          "Phone number must be a valid Nigerian phone number",
      }),
    status: Joi.string().optional(),
    password: Joi.string().min(6).optional().messages({
      "string.min": "Password must be at least 6 characters long",
    }),
    address: Joi.string().optional().min(3).max(300).empty(''),
    city: Joi.string().optional().min(2).max(60).empty(''),
    state: Joi.string().optional().min(2).max(60).empty(''),
    country: Joi.string().optional().min(2).max(60).empty(''),
  });

  return userValidationSchema.validate(data, { abortEarly: false });
};


const validateEvent = (data: IEvent): ValidationResult => {
  const eventValidationSchema: ObjectSchema<IEvent> = Joi.object({
    eventImgUrl: Joi.string().empty('').default(''),
    eventName: Joi.string().min(5).max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .required().messages({
        'string.empty': 'Event name is required',
        'string.min': 'Event name must be at least 5 characters long',
        'string.max': 'Event name must not exceed 60 characters long',
        'any.required': 'Event name is required',
        // "string.pattern.base": "Event Name must contain alphanumeric",
      }),
    eventDescription: Joi.string().min(3).max(300).empty('').default('NA'),
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/) // Matches YYYY-MM-DD format
      .required()
      .custom((value, helpers) => {
        const inputDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Remove time portion for comparison

        if (inputDate < today) {
          return helpers.error('any.invalid', { message: 'Event date cannot be in the past' });
        }
        return value;
      })
      .messages({
        'string.empty': 'Event date is required',
        'string.pattern.base': 'Event date must be in YYYY-MM-DD format (e.g., 2025-02-26)',
        'any.required': 'Event date is required',
        'any.invalid': 'Event date cannot be in the past',
      }),
    time: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/) // Matches hh:mm AM/PM format
      .required()
      .custom((value, helpers) => {
        const inputDate = helpers.state.ancestors[0].date; // Get the provided date
        const inputDateTime = new Date(`${inputDate} ${value}`);
        const now = new Date();

        if (inputDateTime < now) {
          return helpers.error('any.invalid', { message: 'Event time cannot be in the past' });
        }
        return value;
      })
      .messages({
        'string.empty': 'Event time is required',
        'string.pattern.base': 'Event time must be in 12-hour format (hh:mm AM/PM)',
        'any.required': 'Event time is required',
        'any.invalid': 'Event time cannot be in the past',
      }),
    eventLocation: Joi.string().min(5).required().messages({
      'string.empty': 'Event location is required',
      'string.min': 'Event location must be at least 5 characters long',
      'any.required': 'Event location is required',
    }),
    numberOfGroups: Joi.alternatives().try(Joi.number(), Joi.string(), Joi.valid(null)).empty('').default(1),
    hostFirstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).optional().empty('').messages({
      'string.min': 'Host first name must be at least 2 characters long',
      "string.pattern.base": "Host First Name must contain only letters",
    }),
    hostLastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).optional().empty('').messages({
      'string.min': 'Host last name must be at least 2 characters long',
      "string.pattern.base": "Host Last Name must contain only letters",
    }),
    hostEmail: Joi.string().email({ tlds: { allow: false } }).optional().empty('').messages({
      'string.email': 'Host email must be a valid email address',
    }),
    isDraft: Joi.boolean().default(false),
  });

  return eventValidationSchema.validate(data, { abortEarly: false });
};



const validateUpdatedEvent = (data: IEvent): ValidationResult => {
  const eventValidationSchema: ObjectSchema<IEvent> = Joi.object({
    eventName: Joi.string().min(5).max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .messages({
        'string.min': 'Event name must be at least 5 characters long',
        'string.max': 'Event name must not exceed 60 characters long',
        // "string.pattern.base": "Event Name must contain alphanumeric characters",
      }),
    eventDescription: Joi.string().min(3).max(300).empty('').default('NA'),
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/) // Matches YYYY-MM-DD format
      .messages({
        'string.pattern.base': 'Event date must be in YYYY-MM-DD format (e.g., 2025-02-26)',
      }),
    time: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/) // Matches hh:mm AM/PM format
      .messages({
        'string.pattern.base': 'Event time must be in 12-hour format (hh:mm AM/PM)',
      }),
    eventLocation: Joi.string().min(3).messages({
      'string.min': 'Event location must be at least 3 characters long',
    }),
    numberOfGroups: Joi.alternatives().try(Joi.number(), Joi.string(), Joi.valid(null)).empty('').default(1),
    hostFirstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      'string.min': 'Host first name must be at least 2 characters long',
      "string.pattern.base": "Host First Name must contain only letters",
    }),
    hostLastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      'string.min': 'Host last name must be at least 2 characters long',
      "string.pattern.base": "Host last Name must contain only letters",
    }),
    hostEmail: Joi.string().email({ tlds: { allow: false } }).messages({
      'string.email': 'Host email must be a valid email address',
    }),
    isDraft: Joi.boolean().default(false),
  });

  return eventValidationSchema.validate(data, { abortEarly: false });
};



const validateEventGroup = (data: IEventGroup): ValidationResult => {
  const eventGroupValidationSchema: ObjectSchema<IEventGroup> = Joi.object({
    eventId: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid event ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).required().messages({ // Validation error messages
      'string.empty': 'Event ID is required',
      'any.required': 'Event ID is required',
    }),
    groupName: Joi.string()
      .min(5)
      .max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/) // Allows letters, numbers, and spaces
      .required()
      .messages({
        'string.empty': 'Group name is required',
        'string.min': 'Group name must be a minimum of 5 characters',
        'string.max': 'Group name must be a minimum of 60 characters',
        // 'string.pattern.base': 'Group name can only contain alphanumeric characters',
        'any.required': 'Group name is required',
      }),
    groupDescription: Joi.string()
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .max(150).empty('').default('NA')
      .messages({
        // 'string.pattern.base': 'Group description can only contain alphanumeric characters',
      }),
    groupCurrency: Joi.string().min(3).valid("NGN", "USD", "CAD", "GBP").required().messages({
      'string.empty': 'Group currency is required',
      'any.required': 'Group currency is required',
      'any.only': 'Group currency must be either "NGN", "USD", "CAD" or "GBP" ',
    }),
    groupPrivacy: Joi.string().valid('general', 'private').default('private').messages({
      'string.empty': 'Group privacy is required',
      'any.only': 'Group privacy must be either "general" or "private"',
    }),
    isDraft: Joi.boolean().default(false),
    serviceFeeAppliedToGuest: Joi.boolean().optional(),
  });

  return eventGroupValidationSchema.validate(data, { abortEarly: false });
};


const validateUpdatedEventGroup = (data: IEventGroup): ValidationResult => {
  const eventGroupValidationSchema: ObjectSchema<IEventGroup> = Joi.object({
    groupName: Joi.string().min(5).max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .messages({
        'string.min': 'Group name must be a minimum of 5 character',
        'string.max': 'Group name must be a minimum of 60 characters',
        // 'string.pattern.base': 'Group name can only contain alphanumeric characters',
      }),
    groupDescription: Joi.string()
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .max(150).empty('').default('NA').messages({
        // 'string.pattern.base': 'Group description can only contain alphanumeric characters',
      }),
    groupCurrency: Joi.string().min(3).valid("NGN", "USD", "CAD", "GBP").empty('').optional().messages({
      'any.only': 'Group currency must be either "NGN", "USD", "CAD" or "GBP" ',
    }),
    groupPrivacy: Joi.string().valid('general', 'private').default('private').messages({
      'any.only': 'Group privacy must be either "general" or "private"',
    }),
    isDraft: Joi.boolean().default(false),
    serviceFeeAppliedToGuest: Joi.boolean().optional(),
  });

  return eventGroupValidationSchema.validate(data, { abortEarly: false });
};


const validatePackage = (data: IPackage): ValidationResult => {
  const packageValidationSchema: ObjectSchema<IPackage> = Joi.object({
    eventId: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid event ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).required().messages({ // Validation error messages
      'string.empty': 'Event ID is required',
      'any.required': 'Event ID is required',
    }),
    groupId: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid event group ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).required().messages({ // Validation error messages
      'string.empty': 'Event group ID is required',
      'any.required': 'Event group ID is required',
    }),
    packageTitle: Joi.string().min(2).max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .required().messages({
        'string.empty': 'Package title is required',
        'string.min': 'Package title must be a minimum of 2 character',
        'string.max': 'Package title must be a maximum of 60 characters',
        'any.required': 'Package title is required',
        // 'string.pattern.base': 'Package title can only contain alphanumeric characters',
      }),
    packageDescription: Joi.string().min(5).max(150)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .optional().empty('').default('').messages({
        'string.max': 'Package description must be a minimum of 150 character',
        // 'string.pattern.base': 'Package description can only contain alphanumeric characters',
      }),
    packagePriceCurrency: Joi.string().min(3).valid("NGN", "USD", "CAD", "GBP").required().messages({
      'string.empty': 'Package price currency is required',
      'any.required': 'Package price currency is required',
      'any.only': 'Package price currency must be either "NGN", "USD", "CAD" or "GBP" ',
    }),
    packagePrice: Joi.number().min(0).required().messages({
      'number.base': 'Package price must be a number',
      'number.min': 'Package price must be greater or equal to zero',
      'any.required': 'Package price is required',
    }),
    packageQuantity: Joi.number().min(0).optional().empty('').messages({
      'number.base': 'Package quantity must be a number',
      'number.min': 'Package quantity must be greater or equal to zero',
    }),
    packageDelivery: Joi.string()
      .custom((value, helpers) => {
        const validOptions = ["pickUp", "platformDelivery", "selfManaged"];

        const parts = value.split(",").map((str: string) => str.trim());
        const isValid = parts.every((option: any) => validOptions.includes(option));

        if (!isValid) {
          return helpers.error("any.only");
        }

        return value;
      })
      .default("pickUp")
      .empty("")
      .optional()
      .messages({
        "any.only": 'Package delivery must contain only "pickUp", "platformDelivery", and/or "selfManaged" in any order.',
      }),
    packageImgUrls: Joi.array().items(Joi.string()).optional(),
    packageSize: Joi.string().valid("smallBox", "mediumBox", "largeBox", "extraLargeBox").optional().empty('').messages({
      'any.only': 'Package size must be either "Small Box", "Medium Box", "Large Box", or "Extra Large Box"',
    }),
    packageStatus: Joi.string().valid("draft", "active", "archived", "deleted").optional().messages({
      'any.only': 'Package status must be either "draft", "active", "archived" or "deleted"',
    }),
    isDraft: Joi.boolean().default(false),
    souvenirListingId: Joi.string()
      .optional()
      .allow("", null)
      .custom((value, helpers) => {
        if (!value || value === "") return value;
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.message({ custom: "Invalid souvenirListingId." });
        }
        return value;
      }),
    customBagListingId: Joi.string()
      .optional()
      .allow("", null)
      .custom((value, helpers) => {
        if (!value || value === "") return value;
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.message({ custom: "Invalid customBagListingId." });
        }
        return value;
      }),
  });

  return packageValidationSchema.validate(data, { abortEarly: false });
};


const validateUpdatedPackage = (data: IPackage): ValidationResult => {
  const packageValidationSchema: ObjectSchema<IPackage> = Joi.object({
    eventId: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid event ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).optional(),
    packageTitle: Joi.string().min(2).max(60)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .messages({
        'string.min': 'Package title must be a minimum of 2 characters',
        'string.max': 'Package title must be maximum of 60 characters',
        // 'string.pattern.base': 'Package title can only contain alphanumeric characters',
      }),
    packageDescription: Joi.string().min(5).max(150)
      // .pattern(/^[A-Za-z0-9 '_-]+$/)
      .empty('').optional().messages({
        'string.max': 'Package description must be a minimum of 150 character',
        // 'string.pattern.base': 'Package description can only contain alphanumeric characters',
      }),
    packagePriceCurrency: Joi.string().min(3).valid("NGN", "USD", "CAD", "GBP").empty('').optional().messages({
      'any.only': 'Package price currency must be either "NGN", "USD", "CAD" or "GBP" ',
    }),
    packagePrice: Joi.number().min(0).messages({
      'number.min': 'Package price must be greater or equal to zero',
    }),
    packageQuantity: Joi.number().min(0).messages({
      'number.min': 'Package quantity must be greater or equal to zero',
    }),
    packageDelivery: Joi.string()
      .custom((value, helpers) => {
        const validOptions = ["pickUp", "platformDelivery", "selfManaged"];

        const parts = value.split(",").map((str: string) => str.trim());
        const isValid = parts.every((option: any) => validOptions.includes(option));
        if (!isValid) {
          return helpers.error("any.only");
        }

        return value;
      })
      // .default("pickUp")
      .empty("")
      .optional()
      .messages({
        "any.only": 'Package delivery must contain only "pickUp", "platformDelivery", and/or "selfManaged" in any order.',
      }),
    packageSize: Joi.string().valid("smallBox", "mediumBox", "largeBox", "extraLargeBox").optional().empty('').messages({
      'any.only': 'Package size must be either "Small Box", "Medium Box", "Large Box", or "Extra Large Box"',
    }),
    packageImgUrls: Joi.array().items(Joi.string()).optional(),
    publicIdsToReplace: Joi.string().optional(),
    packageStatus: Joi.string().valid("draft", "active", "archived", "deleted").optional().messages({
      'any.only': 'Package status must be either "draft", "active", "archived" or "deleted"',
    }),
    isDraft: Joi.boolean().default(false),
    souvenirListingId: Joi.string()
      .optional()
      .allow("", null)
      .custom((value, helpers) => {
        if (!value || value === "") return value;
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.message({ custom: "Invalid souvenirListingId." });
        }
        return value;
      }),
    customBagListingId: Joi.string()
      .optional()
      .allow("", null)
      .custom((value, helpers) => {
        if (!value || value === "") return value;
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.message({ custom: "Invalid customBagListingId." });
        }
        return value;
      }),
  });

  return packageValidationSchema.validate(data, { abortEarly: false });
};


const validateContact = (data: IContact): ValidationResult => {
  const contactValidationSchema: ObjectSchema<IContact> = Joi.object({
    // user: Joi.string().custom((value, helpers) => {
    //   if (!mongoose.Types.ObjectId.isValid(value)) {
    //     return helpers.message({ custom: 'Invalid user ID. Must be a valid MongoDB ObjectId' });
    //   }
    //   return value;
    // }).required().messages({
    //   'string.empty': 'User ID is required',
    //   'any.required': 'User ID is required',
    // }),
    contacts: Joi.array()
      .items(
        Joi.object({
          guestName: Joi.string()
            .min(2)
            .max(60)
            .required()
            .messages({
              "string.empty": "Guest name cannot be left empty",
              "string.min": "Guest name must be at least 2 characters",
              "string.max": "Guest name must be at most 60 characters",
            }),

          guestPhoneNumber: Joi.string()
            .pattern(/^[0-9]+$/)
            .required()
            .messages({
              "string.empty": "Guest phone number cannot be left empty",
              "string.pattern.base": "Guest phone number must contain only digits",
            }),
        })
      )
      .required()
      .messages({
        "array.base": "Contacts must be an array",
        "any.required": "Contacts are required",
      }),
  });

  return contactValidationSchema.validate(data, { abortEarly: false });
};


// List of valid time zone abbreviations
const validTimeZones = [
  "UTC", "GMT", "WAT", "CAT", "EAT", "PST", "CST", "EST", "MST",
  "AKST", "HST", "IST", "CET", "EET", "BST", "AST", "NST", "JST",
  "KST", "AEST", "ACST", "AWST"
];

// const validatePaymentAndDelivery = (data: IPaymentAndDelivery): ValidationResult => {
//   const paymentAndDeliveryValidationSchema: ObjectSchema<IPaymentAndDelivery> = Joi.object({
//     accountNumber: Joi.string().min(10).max(10).pattern(/^[0-9]+$/).required().messages({
//       'string.empty': 'Account number is required',
//       'string.min': 'Account number must be at most 10 digits',
//       'string.max': 'Account number must be at most 10 digits',
//       'string.pattern.base': 'Account number must contain only digits',
//     }),
//     bankName: Joi.string().min(3).max(60).required().messages({
//       'string.empty': 'Bank name is required',
//       'string.min': 'Bank name must be at least 3 characters',
//       'string.max': 'Bank name must be at most 60 characters',
//     }),
//     accountName: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).required().messages({
//       'string.empty': 'Account name is required',
//       'string.min': 'Account name must be at least 3 characters',
//       'string.max': 'Account name must be at most 60 characters',
//       "string.pattern.base": "Account Name must contain only letters",
//     }),
//     paymentDate: Joi.string()
//     .pattern(/^\d{4}-\d{2}-\d{2}$/) // Matches YYYY-MM-DD format
//     .required()
//     .custom((value, helpers) => {
//       const inputDate = new Date(value);
//       const today = new Date();
//       today.setHours(0, 0, 0, 0); // Remove time portion for comparison

//       if (inputDate < today) {
//         return helpers.error('any.invalid', { message: 'Payment date cannot be in the past' });
//       }
//       return value;
//     })
//     .messages({
//       'string.empty': 'Payment date is required',
//       'string.pattern.base': 'Payment date must be in YYYY-MM-DD format (e.g., 2025-02-26)',
//       'any.required': 'Payment date is required',
//       'any.invalid': 'Payment date cannot be in the past',
//     }),
//     paymentTime: Joi.string()
//     .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/) // Matches hh:mm AM/PM format
//     .custom((value, helpers) => {
//       const inputDate = helpers.state.ancestors[0].date; // Get the provided date
//       const inputDateTime = new Date(`${inputDate} ${value}`);
//       const now = new Date();

//       if (inputDateTime < now) {
//         return helpers.error('any.invalid', { message: 'Payment time cannot be in the past' });
//       }
//       return value;
//     })
//     .messages({
//       'string.empty': 'Payment time is required',
//       'string.pattern.base': 'Payment time must be in 12-hour format (hh:mm AM/PM)',
//       'any.required': 'Payment time is required',
//       'any.invalid': 'Payment time cannot be in the past',
//     }),
//     paymentTimeZone: Joi.string()
//     .valid(...validTimeZones) // Ensures input is one of the valid time zones
//     .required()
//     .messages({
//       "any.required": "Payment time zone is required.",
//       "any.only": "Invalid time zone. Please enter a valid time zone (e.g., WAT, EST, UTC)."
//     }),
//     contactName: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).required().messages({
//       'string.empty': 'Contact name is required',
//       'string.min': 'Contact name must be at least 3 characters',
//       'string.max': 'Contact name must be at most 60 characters',
//       "string.pattern.base": "Contact Name must contain only letters",
//     }),
//     pickupLocation: Joi.string().min(5).max(150).required().messages({
//       'string.empty': 'Pickup Location is required',
//       'string.min': 'Pickup Location must be at least 5 characters',
//       'string.max': 'Pickup Location must be at most 150 characters',
//     }),
//     deliveryDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/) // Matches YYYY-MM-DD format
//     .required()
//     .custom((value, helpers) => {
//       const inputDate = new Date(value);
//       const today = new Date();
//       today.setHours(0, 0, 0, 0); // Remove time portion for comparison

//       if (inputDate < today) {
//         return helpers.error('any.invalid', { message: 'Delivery date cannot be in the past' });
//       }
//       return value;
//     })
//     .messages({
//       'string.empty': 'Delivery date is required',
//       'string.pattern.base': 'Delivery date must be in YYYY-MM-DD format (e.g., 2025-02-26)',
//       'any.required': 'Delivery date is required',
//       'any.invalid': 'Delivery date cannot be in the past',
//     }),
//     deliveryTime: Joi.string().pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/) // Matches hh:mm AM/PM format
//     .custom((value, helpers) => {
//       const inputDate = helpers.state.ancestors[0].date; // Get the provided date
//       const inputDateTime = new Date(`${inputDate} ${value}`);
//       const now = new Date();

//       if (inputDateTime < now) {
//         return helpers.error('any.invalid', { message: 'Delivery time cannot be in the past' });
//       }
//       return value;
//     })
//     .messages({
//       'string.empty': 'Delivery time is required',
//       'string.pattern.base': 'Delivery time must be in 12-hour format (hh:mm AM/PM)',
//       'any.required': 'Delivery time is required',
//       'any.invalid': 'Delivery time cannot be in the past',
//     }),
//     deliveryTimeZone: Joi.string().valid(...validTimeZones) // Ensures input is one of the valid time zones
//     .required()
//     .messages({
//       "any.required": "Payment time zone is required.",
//       "any.only": "Invalid time zone. Please enter a valid time zone (e.g., WAT, EST, UTC)."
//     }),
//   });

//   return paymentAndDeliveryValidationSchema.validate(data, { abortEarly: false });
// };

const nairaAccountSchema: ObjectSchema<INairaPayout> = Joi.object({
  accountNumber: Joi.string().length(10).min(10).max(10).pattern(/^[0-9]+$/).required().messages({
    "string.empty": "Account number is required",
    "string.length": "Account number must be exactly 10 digits",
    "string.min": "Account number must be exactly 10 digits",
    "string.max": "Account number must be exactly 10 digits",
    "string.pattern.base": "Account number must contain only digits",
  }),
  bankName: Joi.string().trim().min(3).max(60).required().messages({
    "string.empty": "Bank name is required",
    "string.min": "Bank name must be at least 3 characters",
    "string.max": "Bank name must be at most 60 characters",
  }),
  accountName: Joi.string().trim().min(3).max(60).pattern(/^[A-Za-z\s]+$/).required().messages({
    "string.empty": "Account name is required",
    "string.min": "Account name must be at least 3 characters",
    "string.max": "Account name must be at most 60 characters",
    "string.pattern.base": "Account name must contain only letters and spaces",
  }),
  bankCode: Joi.string().min(3).max(7).pattern(/^[0-9]+$/).messages({
    "string.min": "Bank code must be exactly 3 digits",
    "string.max": "Bank code must be exactly 7 digits",
    "string.pattern.base": "Bank code must contain only digits",
  }),
});

const dollarAccountSchema: ObjectSchema<IDollarPayout> = Joi.object({
  usAccountNumber: Joi.string().pattern(/^[0-9]+$/).min(7).max(17).required().messages({
    "string.empty": "Account number is required",
    'string.min': 'Account number must be at least 7 digits.',
    'string.max': 'Account number must not exceed 17 digits.',
    "string.pattern.base": "Account number must contain only digits",
  }),
  routingNumber: Joi.string().pattern(/^[0-9]+$/).min(9).max(9).length(9) // Routing numbers in the U.S. are exactly 9 digits
    .required()
    .messages({
      "string.empty": "Routing number is required",
      "string.length": "Routing number must be exactly 9 digits",
      "string.min": "Routing number must be exactly 9 digits",
      "string.max": "Routing number must be exactly 9 digits",
      "string.pattern.base": "Routing number must contain only digits",
    }),
  usBankName: Joi.string().trim().min(3).max(60).required().messages({
    "string.empty": "Bank name is required",
    "string.min": "Bank name must be at least 3 characters",
    "string.max": "Bank name must be at most 60 characters",
  }),
  usAccountName: Joi.string().trim().min(3).max(60).pattern(/^[A-Za-z\s]+$/).required().messages({
    "string.empty": "Account name is required",
    "string.min": "Account name must be at least 3 characters",
    "string.max": "Account name must be at most 60 characters",
    "string.pattern.base": "Account name must contain only letters and spaces",
  }),
});


const validatePaymentAndDelivery = (data: IPaymentAndDelivery): ValidationResult => {
  const schema: ObjectSchema<IPaymentAndDelivery> = Joi.object({
    event: Joi.string().required().messages({
      "string.empty": "Event ID cannot be left empty.",
      "any.required": "Event ID is required.",
    }),
    nairaAccount: Joi.alternatives()
      .try(nairaAccountSchema, Joi.allow(null)) // Allow either valid schema or null
      .optional(),

    dollarAccount: Joi.alternatives()
      .try(dollarAccountSchema, Joi.allow(null)) // Allow either valid schema or null
      .optional(),
    paymentDate: Joi.date().iso().required().messages({
      "date.base": "Payment date must be a valid date",
      "date.format": "Payment date must be in YYYY-MM-DD format",
    }),
    paymentTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .required()
      .messages({
        "string.empty": "Payment time is required",
        "string.pattern.base": "Payment time must be in 12-hour format (hh:mm AM/PM)",
      }),
    paymentTimeZone: Joi.string().valid(...validTimeZones).required().messages({
      "any.required": "Payment time zone is required.",
      "any.only": "Invalid time zone. Please enter a valid time zone.",
    }),
    contactName: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "Contact name must be at least 3 characters",
      "string.max": "Contact name must be at most 60 characters",
      "string.pattern.base": "Contact name must contain only letters",
    }),
    contactPhoneNumber: Joi.string().pattern(/^[0-9]+$/).optional().messages({
      "string.pattern.base": "Contact phone number must contain only digits",
    }),
    pickupLocation: Joi.string().min(5).max(150).optional().messages({
      "string.min": "Pickup Location must be at least 5 characters",
      "string.max": "Pickup Location must be at most 150 characters",
    }),
    pickupLatitude: Joi.string().optional().empty('').pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Latitude must be a valid decimal number',
        'number.base': 'Latitude must be a valid number',
        'number.range': 'Latitude must be between -90 and 90'
      }),
    pickupLongitude: Joi.string().optional().empty('').pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Longitude must be a valid decimal number',
        'number.base': 'Longitude must be a valid number',
        'number.range': 'Longitude must be between -180 and 180'
      }),
    state: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "State must be at least 3 characters",
      "string.max": "State must be at most 60 characters",
      "string.pattern.base": "State must contain only letters",
    }),
    city: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "City must be at least 3 characters",
      "string.max": "City must be at most 60 characters",
      "string.pattern.base": "City must contain only letters",
    }),
    deliveryDate: Joi.date().iso().optional().messages({
      "date.base": "Delivery date must be a valid date",
      "date.format": "Delivery date must be in YYYY-MM-DD format",
    }),
    deliveryTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .optional()
      .messages({
        "string.pattern.base": "Delivery time must be in 12-hour format (hh:mm AM/PM)",
      }),
    deliveryTimeZone: Joi.string().valid(...validTimeZones).optional().messages({
      "any.only": "Invalid time zone. Please enter a valid time zone.",
    }),
    isDraft: Joi.boolean().default(false),
  });

  return schema.validate(data, { abortEarly: false });
};



const validateOptionalPaymentAndDeliveryUpdate = (
  data: Partial<IPaymentAndDelivery>
): ValidationResult => {
  const schema: ObjectSchema<Partial<IPaymentAndDelivery>> = Joi.object({
    event: Joi.string().optional().messages({
      "string.empty": "Event ID cannot be left empty.",
    }),

    nairaAccount: Joi.alternatives()
      .try(nairaAccountSchema, Joi.allow(null))
      .optional(),

    dollarAccount: Joi.alternatives()
      .try(dollarAccountSchema, Joi.allow(null))
      .optional(),

    paymentDate: Joi.date().iso().optional().messages({
      "date.base": "Payment date must be a valid date",
      "date.format": "Payment date must be in YYYY-MM-DD format",
    }),

    paymentTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .optional()
      .messages({
        "string.pattern.base": "Payment time must be in 12-hour format (hh:mm AM/PM)",
      }),

    paymentTimeZone: Joi.string()
      .valid(...validTimeZones)
      .optional()
      .messages({
        "any.only": "Invalid time zone. Please enter a valid time zone.",
      }),

    contactName: Joi.string()
      .min(3)
      .max(60)
      .pattern(/^[A-Za-z ]+$/)
      .optional()
      .messages({
        "string.min": "Contact name must be at least 3 characters",
        "string.max": "Contact name must be at most 60 characters",
        "string.pattern.base": "Contact name must contain only letters",
      }),

    contactPhoneNumber: Joi.string()
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        "string.pattern.base": "Contact phone number must contain only digits",
      }),

    pickupLocation: Joi.string()
      .min(5)
      .max(150)
      .optional()
      .messages({
        "string.min": "Pickup Location must be at least 5 characters",
        "string.max": "Pickup Location must be at most 150 characters",
      }),

    pickupLatitude: Joi.string()
      .optional()
      .empty('')
      .pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Latitude must be a valid decimal number',
        'number.base': 'Latitude must be a valid number',
        'number.range': 'Latitude must be between -90 and 90',
      }),

    pickupLongitude: Joi.string()
      .optional()
      .empty('')
      .pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Longitude must be a valid decimal number',
        'number.base': 'Longitude must be a valid number',
        'number.range': 'Longitude must be between -180 and 180',
      }),

    state: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "State must be at least 3 characters",
      "string.max": "State must be at most 60 characters",
      "string.pattern.base": "State must contain only letters",
    }),

    city: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "City must be at least 3 characters",
      "string.max": "City must be at most 60 characters",
      "string.pattern.base": "City must contain only letters",
    }),

    deliveryDate: Joi.date().iso().optional().messages({
      "date.base": "Delivery date must be a valid date",
      "date.format": "Delivery date must be in YYYY-MM-DD format",
    }),

    deliveryTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .optional()
      .messages({
        "string.pattern.base": "Delivery time must be in 12-hour format (hh:mm AM/PM)",
      }),

    deliveryTimeZone: Joi.string()
      .valid(...validTimeZones)
      .optional()
      .messages({
        "any.only": "Invalid time zone. Please enter a valid time zone.",
      }),

    isDraft: Joi.boolean().default(false),
  });

  return schema.validate(data, { abortEarly: false });
};



// Function to validate update payload
const validatePaymentAndDeliveryUpdate = (
  data: Partial<IPaymentAndDelivery>
): ValidationResult => {
  const schema: ObjectSchema = Joi.object({
    nairaAccount: nairaAccountSchema.optional(),

    dollarAccount: dollarAccountSchema.optional(),

    paymentDate: Joi.string()
      .allow(null, '')
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      //   .custom((value, helpers) => {
      //     if (!value) return value; // skip validation for empty/null
      //     const inputDate = new Date(value);

      //         if (isNaN(inputDate.getTime())) {
      //   return helpers.error("any.invalid", {
      //     message: "Payment date is not a valid date",
      //   });
      // }

      //     const today = new Date();
      //     today.setHours(0, 0, 0, 0);

      //     if (inputDate < today) {
      //       return helpers.error("any.invalid", {
      //         message: "Payment date cannot be in the past",
      //       });
      //     }
      //     return value;
      //   })
      .messages({
        "string.pattern.base": "Payment date must be in YYYY-MM-DD format",
      }),

    paymentTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Payment time must be in 12-hour format (hh:mm AM/PM)",
      }),

    paymentTimeZone: Joi.string()
      .valid(...validTimeZones)
      .optional()
      .messages({
        "any.only": "Invalid time zone. Please enter a valid time zone.",
      }),

    contactName: Joi.string().min(3).max(60).optional().messages({
      "string.min": "Contact name must be at least 3 characters",
      "string.max": "Contact name must be at most 60 characters",
    }),

    contactPhoneNumber: Joi.string()
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        "string.pattern.base": "Contact phone number must contain only digits",
      }),

    pickupLocation: Joi.string().min(5).max(150).optional().messages({
      "string.min": "Pickup location must be at least 5 characters",
      "string.max": "Pickup location must be at most 150 characters",
    }),

    pickupLatitude: Joi.string()
      .optional()
      .empty("")
      .pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, "Coordinate validation")
      .messages({
        "string.pattern.base": "Latitude must be a valid decimal number",
        "number.base": "Latitude must be a valid number",
        "number.range": "Latitude must be between -90 and 90",
      }),

    pickupLongitude: Joi.string()
      .optional()
      .empty("")
      .pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, "Coordinate validation")
      .messages({
        "string.pattern.base": "Longitude must be a valid decimal number",
        "number.base": "Longitude must be a valid number",
        "number.range": "Longitude must be between -180 and 180",
      }),

    state: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "State must be at least 3 characters",
      "string.max": "State must be at most 60 characters",
      "string.pattern.base": "State must contain only letters",
    }),

    city: Joi.string().min(3).max(60).pattern(/^[A-Za-z ]+$/).optional().messages({
      "string.min": "City must be at least 3 characters",
      "string.max": "City must be at most 60 characters",
      "string.pattern.base": "City must contain only letters",
    }),

    deliveryDate: Joi.string()
      .allow(null, '')
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .custom((value, helpers) => {
        if (!value) return value; // skip validation for empty/null

        const inputDate = new Date(value);

        if (isNaN(inputDate.getTime())) {
          return helpers.message({
            custom: "Delivery date is not a valid date",
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inputDate < today) {
          return helpers.message({
            custom: "Delivery date cannot be in the past",
          });
        }

        return value;
      })
      .messages({
        "string.pattern.base": "Delivery date must be in YYYY-MM-DD format",
      }),


    deliveryTime: Joi.string()
      .pattern(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
      .optional()
      .messages({
        "string.pattern.base":
          "Delivery time must be in 12-hour format (hh:mm AM/PM)",
      }),

    deliveryTimeZone: Joi.string()
      .valid(...validTimeZones)
      .optional()
      .messages({
        "any.only": "Invalid time zone. Please enter a valid time zone.",
      }),

    isDraft: Joi.boolean().default(false),
  });

  return schema.validate(data, { abortEarly: false });
};




const validateCoHost = (data: UserData): ValidationResult => {
  const userValidationSchema: ObjectSchema<UserData> = Joi.object({
    eventId: Joi.string().optional().empty(''),
    firstName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "First Name must be at least 2 characters long",
      "string.pattern.base": "First Name must contain only letters",
    }),
    lastName: Joi.string().min(2).pattern(/^[A-Za-z]+$/).messages({
      "string.min": "lastName must be at least 2 characters long",
      "string.pattern.base": "Last Name must contain only letters",
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    phoneNumber: Joi.string()
      .allow(null, ""),
    temporaryUserId: Joi.string().min(3).optional(),
    password: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .optional().empty('')
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.max": "Password must not exceed 20 characters",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
      }),
    confirmPassword: Joi.string()
      .min(6)
      .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:',.<>?/])/))
      .optional().empty('')
      .messages({
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base":
          "Password must contain lowercase, uppercase, numbers, and special characters",
      }),
  });

  return userValidationSchema.validate(data, { abortEarly: false });
};


const validateDiscount = (data: IDiscount): ValidationResult => {
  const discountValidationSchema: ObjectSchema<IDiscount> = Joi.object({
    event: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid event ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).required().messages({ // Validation error messages
      'string.empty': 'Event ID is required',
      'any.required': 'Event ID is required',
    }),
    hostId: Joi.string().custom((value, helpers) => { // Custom validation for MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message({ custom: 'Invalid Host ID. Must be a valid MongoDB ObjectId' });
      }
      return value;
    }).required().messages({ // Validation error messages
      'string.empty': 'Host ID is required',
      'any.required': 'Host ID is required',
    }),
    discountTitle: Joi.string().min(3).max(25).pattern(/^[A-Za-z0-9 '_-]+$/).required().messages({
      'string.empty': 'Discount title is required',
      'string.min': 'Discount title must be at least 3 characters long',
      'string.max': 'Discount title must not exceed 25 characters long',
      "string.pattern.base": "Discount Title must contain alphanumeric characters",
    }),
    discountValue: Joi.number().min(1).required().messages({
      'number.base': 'Discount value must be a number',
      'number.min': 'Discount value must be greater or equal to one',
      'any.required': 'Discount value is required',
    }),
    discountValueType: Joi.string().valid('percentage', 'NGN', 'USD').required().messages({
      'any.only': 'Discount value type must be either "percentage", "NGN" or "USD"',
      'any.required': 'Discount value type is required',
    }),
    discountStatus: Joi.string().valid('active', 'inactive').default('active').messages({
      'any.only': 'Discount status must be either "active" or "inactive"',
    }),
    discountCode: Joi.string().min(3).max(20).pattern(/^[A-Za-z0-9]+$/).messages({
      'string.min': 'Discount code must be at least 3 characters long',
      'string.max': 'Discount code must not exceed 20 characters long',
      "string.pattern.base": "Discount Code must contain alphanumeric characters",
    }),
  });

  return discountValidationSchema.validate(data, { abortEarly: false });
}



const validateDiscountUpdate = (data: IDiscount): ValidationResult => {
  const discountValidationSchema: ObjectSchema<IDiscount> = Joi.object({
    discountTitle: Joi.string().min(3).max(60).pattern(/^[A-Za-z0-9 '_-]+$/).messages({
      'string.min': 'Discount title must be at least 3 characters long',
      'string.max': 'Discount title must not exceed 60 characters long',
      "string.pattern.base": "Discount Title must contain alphanumeric characters",
    }),
    discountValue: Joi.number().min(1).messages({
      'number.base': 'Discount value must be a number',
      'number.min': 'Discount value must be greater or equal to one',
    }),
    discountValueType: Joi.string().valid('percentage', 'NGN', 'USD').messages({
      'any.only': 'Discount value type must be either "percentage", "NGN" or "USD"',
    }),
    discountStatus: Joi.string().valid('active', 'inactive').default('active').messages({
      'any.only': 'Discount status must be either "active" or "inactive"',
    }),
    discountCode: Joi.string().min(3).max(20).pattern(/^[A-Za-z0-9]+$/).messages({
      'string.min': 'Discount code must be at least 3 characters long',
      'string.max': 'Discount code must not exceed 20 characters long',
      "string.pattern.base": "Discount Code must contain alphanumeric characters",
    }),
  });

  return discountValidationSchema.validate(data, { abortEarly: false });
}


const validateGuestCheckout = (data: IOrder): ValidationResult => {
  const guestCheckoutSchema: ObjectSchema<IOrder> = Joi.object({
    guestFirstName: Joi.string().min(2).max(50).pattern(/^[A-Za-z\s'-]+$/).required().messages({
      'string.empty': 'Guest first name is required',
      'string.min': 'Guest first name must be at least 2 characters long',
      'string.max': 'Guest first name must not exceed 50 characters',
      'string.pattern.base': 'Guest first name must contain only letters, spaces, hyphens, or apostrophes',
      'any.required': 'Guest first name is required',
    }),
    guestLastName: Joi.string().min(2).max(50).pattern(/^[A-Za-z\s'-]+$/).required().messages({
      'string.empty': 'Guest last name is required',
      'string.min': 'Guest last name must be at least 2 characters long',
      'string.max': 'Guest last name must not exceed 50 characters',
      'string.pattern.base': 'Guest last name must contain only letters, spaces, hyphens, or apostrophes',
      'any.required': 'Guest last name is required',
    }),
    guestEmail: Joi.string().email().required().messages({
      'string.empty': 'Guest email is required',
      'string.email': 'Guest email must be a valid email address',
      'any.required': 'Guest email is required',
    }),
    guestPhoneNumber: Joi.string().pattern(/^\+?\d{7,15}$/).required().messages({
      'string.empty': 'Guest phone number is required',
      'string.pattern.base': 'Guest phone number must be a valid international phone number (e.g: +23481XXXXXXXXX)',
      'any.required': 'Guest phone number is required',
    }),
    items: Joi.array().items(Joi.object()).min(1).required().messages({
      'array.base': 'Items must be an array',
      'array.min': 'At least one item is required',
      'any.required': 'Items are required',
    }),
    discountCode: Joi.string().alphanum().min(3).max(20).optional().messages({
      'string.min': 'Discount code must be at least 3 characters long',
      'string.max': 'Discount code must not exceed 20 characters',
      'string.alphanum': 'Discount code must contain only alphanumeric characters',
    }),
    shippingAddress: Joi.string().min(5).max(300)
      // .pattern(/^[A-Za-z0-9 .,'_-]+$/)
      .optional().messages({
        'string.min': 'Shipping address must be at least 5 characters long',
        'string.max': 'Shipping address must not exceed 300 characters long',
        // "string.pattern.base": "Shipping address must contain alphanumeric characters",
      }),
    addressLatitude: Joi.string().optional().empty('').pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Latitude must be a valid decimal number',
        'number.base': 'Latitude must be a valid number',
        'number.range': 'Latitude must be between -90 and 90'
      }),
    addressLongitude: Joi.string().optional().empty('').pattern(/^-?\d{1,3}(\.\d+)?$/)
      .custom(validateCoordinate, 'Coordinate validation')
      .messages({
        'string.pattern.base': 'Longitude must be a valid decimal number',
        'number.base': 'Longitude must be a valid number',
        'number.range': 'Longitude must be between -180 and 180'
      }),
    state: Joi.string().min(3).max(50).pattern(/^[A-Za-z0-9 '_-]+$/).optional().messages({
      'string.min': 'State must be at least 3 characters long',
      'string.max': 'State must not exceed 50 characters long',
      "string.pattern.base": "State must contain alphanumeric characters",
    }),
    city: Joi.string().min(3).max(50).pattern(/^[A-Za-z0-9 '_-]+$/).optional().messages({
      'string.min': 'City must be at least 3 characters long',
      'string.max': 'City must not exceed 50 characters long',
      "string.pattern.base": "City must contain alphanumeric characters",
    }),
    dispatchType: Joi.string().min(3).max(50).pattern(/^[A-Za-z0-9 '_-]+$/).optional().messages({
      'string.min': 'Dispatch type must be at least 3 characters long',
      'string.max': 'Dispatch type must not exceed 50 characters long',
      "string.pattern.base": "Dispatch type must contain alphanumeric characters",
    }),
    deliveryType: Joi.string().valid('pickUp', 'homeDelivery', 'platformDelivery', 'selfManaged').optional().messages({
      'any.only': 'Delivery type must be either "Pick Up", "Platform Delivery", "Self Managed Delivery"',
    }),
  });

  return guestCheckoutSchema.validate(data, { abortEarly: false });
};



export {
  validateUser,
  validateAdmin,
  validateU,
  validateEmail,
  validateResetPassword,
  validateUpdatedUser,
  validateEvent,
  validateUpdatedEvent,
  validateEventGroup,
  validateUpdatedEventGroup,
  validatePackage,
  validateUpdatedPackage,
  validateContact,
  validatePaymentAndDelivery,
  validatePaymentAndDeliveryUpdate,
  validateCoHost,
  validateDiscount,
  validateDiscountUpdate,
  validateGuestCheckout,
};
