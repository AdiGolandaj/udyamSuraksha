import { z } from "zod";

// Step 1: Role Selection
export const roleSelectionSchema = z.object({
  role: z.enum(["msme", "lrdb"]),
});

// Step 2: Business Details (MSME only)
export const businessDetailsSchema = z.object({
  shopName: z.string().min(2).max(100),
  category: z.string().min(1),
  ownerName: z.string().min(2).max(100),
  phoneNumber: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10-digit number"),
  gstNumber: z.string().optional(),
  establishedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

// Step 3A: Location Geocoding (automatic GPS or manual entry)
export const locationGeocodingSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  manuallySet: z.boolean().default(false),
});

// Step 3B: Building Details
export const buildingDetailsSchema = z.object({
  powerSupplyType: z.enum(["GRID", "SOLAR", "GENERATOR", "MIXED"]),
  connectivityType: z.enum(["FOUR_G", "THREE_G", "TWO_G", "NONE"]),
  shopFloorLevel: z.enum(["GROUND", "FIRST", "BASEMENT"]),
  buildingType: z.enum(["PUCCA", "SEMI_PUCCA", "KUTCHA"]),
  roofType: z.enum(["RCC_SLAB", "TIN_SHEET", "ASBESTOS", "TILED", "THATCHED"]),
  hasBasement: z.boolean().default(false),
  storageFloorLevel: z.enum(["GROUND_LEVEL", "ELEVATED_SHELF", "FIRST_FLOOR"]),
  shopAreaSqFt: z.coerce.number().int().positive().optional(),
});

// Step 3B (continued): Address details after location confirmation
export const locationAddressSchema = z.object({
  village: z.string().min(1),
  taluka: z.string().min(1),
  district: z.string().min(1),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be 6 digits"),
});

// Step 4: Preferences & Emergency Contact
export const preferencesSchema = z.object({
  language: z.enum(["en", "mr", "hi"]),
  notifyViaApp: z.boolean().default(true),
  notifyViaEmail: z.boolean().default(true),
  notifyViaSms: z.boolean().default(false),
  notifyViaWhatsapp: z.boolean().default(false),
  emergencyContactName: z.string().min(2).max(100),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10-digit number"),
  emergencyContactRelationship: z.string().min(1),
});

// Full registration schema (for final submission)
export const registerSchema = z.object({
  // Step 1
  role: z.enum(["msme", "lrdb"]),

  // Step 2 (MSME only)
  shopName: z.string().min(2).max(100).optional(),
  category: z.string().optional(),
  ownerName: z.string().min(2).max(100).optional(),
  phoneNumber: z.string().optional(),
  gstNumber: z.string().optional(),
  establishedYear: z.coerce.number().optional(),

  // Step 3A & 3B
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  manuallySet: z.boolean().default(false),
  village: z.string().min(1),
  taluka: z.string().min(1),
  district: z.string().min(1),
  pincode: z.string().regex(/^[0-9]{6}$/),
  powerSupplyType: z.enum(["GRID", "SOLAR", "GENERATOR", "MIXED"]),
  connectivityType: z.enum(["FOUR_G", "THREE_G", "TWO_G", "NONE"]),
  shopFloorLevel: z.enum(["GROUND", "FIRST", "BASEMENT"]),
  buildingType: z.enum(["PUCCA", "SEMI_PUCCA", "KUTCHA"]),
  roofType: z.enum(["RCC_SLAB", "TIN_SHEET", "ASBESTOS", "TILED", "THATCHED"]),
  hasBasement: z.boolean().default(false),
  storageFloorLevel: z.enum(["GROUND_LEVEL", "ELEVATED_SHELF", "FIRST_FLOOR"]),
  shopAreaSqFt: z.coerce.number().int().positive().optional(),

  // Step 4
  language: z.enum(["en", "mr", "hi"]),
  notifyViaApp: z.boolean().default(true),
  notifyViaEmail: z.boolean().default(true),
  notifyViaSms: z.boolean().default(false),
  notifyViaWhatsapp: z.boolean().default(false),
  emergencyContactName: z.string().min(2).max(100),
  emergencyContactPhone: z.string().regex(/^[0-9]{10}$/),
  emergencyContactRelationship: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type BusinessDetailsInput = z.infer<typeof businessDetailsSchema>;
export type BuildingDetailsInput = z.infer<typeof buildingDetailsSchema>;
export type LocationAddressInput = z.infer<typeof locationAddressSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
