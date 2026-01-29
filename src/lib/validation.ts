import { z } from 'zod';

// Input sanitization utilities
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

// Email validation schema
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .transform(sanitizeInput);

// Phone validation schema
export const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must not exceed 15 digits')
  .regex(/^[\d\s\-\+\(\)]+$/, 'Phone number contains invalid characters')
  .transform((val) => val.replace(/\s+/g, '').replace(/[-\(\)]/g, ''));

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

// Business name validation schema
export const businessNameSchema = z
  .string()
  .min(2, 'Business name must be at least 2 characters')
  .max(100, 'Business name must not exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s\-&.,']+$/, 'Business name contains invalid characters')
  .transform(sanitizeInput);

// Amount validation schema (for payments, prices, etc.)
export const amountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Please enter a valid amount')
  .transform((val) => parseFloat(val))
  .refine((val) => val > 0, 'Amount must be greater than 0')
  .refine((val) => val <= 1000000, 'Amount must not exceed ₹10,00,000');

// Date validation schema
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date (YYYY-MM-DD)')
  .transform((val) => new Date(val))
  .refine((date) => !isNaN(date.getTime()), 'Please enter a valid date')
  .refine((date) => date <= new Date(), 'Date cannot be in the future');

// Text area validation schema
export const textAreaSchema = z
  .string()
  .max(2000, 'Text must not exceed 2000 characters')
  .transform(sanitizeInput)
  .optional();

// URL validation schema (for portfolio images, etc.)
export const urlSchema = z
  .string()
  .url('Please enter a valid URL')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'URL must use HTTP or HTTPS protocol');

// Combined schemas for forms
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  businessName: businessNameSchema,
  phone: phoneSchema.optional(),
});

export const clientSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters')
    .transform(sanitizeInput),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  address: textAreaSchema,
});

export const bookingSchema = z.object({
  eventName: z.string()
    .min(3, 'Event name must be at least 3 characters')
    .max(200, 'Event name must not exceed 200 characters')
    .transform(sanitizeInput),
  eventDate: dateSchema,
  eventTime: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time (HH:MM)')
    .optional(),
  description: textAreaSchema,
  clientId: z.string().min(1, 'Please select a client'),
  packageId: z.string().min(1, 'Please select a package').optional(),
  location: textAreaSchema,
});

export const packageSchema = z.object({
  name: z.string()
    .min(3, 'Package name must be at least 3 characters')
    .max(100, 'Package name must not exceed 100 characters')
    .transform(sanitizeInput),
  description: textAreaSchema,
  price: amountSchema,
  category: z.string().min(1, 'Please select a category'),
});

export const paymentSchema = z.object({
  amount: amountSchema,
  description: textAreaSchema,
  paymentDate: dateSchema,
  bookingId: z.string().min(1, 'Please select a booking').optional(),
});

// Type exports for TypeScript
export type SignUpData = z.infer<typeof signUpSchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type BookingData = z.infer<typeof bookingSchema>;
export type PackageData = z.infer<typeof packageSchema>;
export type PaymentData = z.infer<typeof paymentSchema>;
