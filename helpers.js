import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "./model.js";


export function roleCheck(roleName) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== roleName) {
      return next(
        new ApiError(403, `Access forbidden. Role '${roleName}' is required.`)
      );
    }
    next();
  };
}

export function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );
}

export function decodeToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return null;
  }
}

// ==========================================
// 2. ERROR CLASSES & HANDLERS
// ==========================================

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid format for field ${err.path}: ${err.value}. Please provide a valid value/ID.`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    message = `Duplicate field value entered: '${value}' for field '${field}'. Please use another value.`;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token. Please log in again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your authentication token has expired. Please log in again.";
  }

  console.error(`[Error] ${req.method} ${req.path} -> Status: ${statusCode}, Message: ${message}`);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ApiError(401, "Authentication failed. Token is missing.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new ApiError(401, "Authentication failed. User no longer exists.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Authentication failed. Token has expired.");
    }
    throw new ApiError(401, "Authentication failed. Invalid token.");
  }
});

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access forbidden. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};

// ==========================================
// 4. REQUEST VALIDATION MIDDLEWARES
// ==========================================

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return next(new ApiError(400, "Name is required."));
  }

  if (!email) {
    return next(new ApiError(400, "Email is required."));
  }

  if (!isValidEmail(email)) {
    return next(new ApiError(400, "Please provide a valid email address."));
  }

  if (!password) {
    return next(new ApiError(400, "Password is required."));
  }

  if (password.length < 8) {
    return next(new ApiError(400, "Password must be at least 8 characters long."));
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email) {
    return next(new ApiError(400, "Email is required."));
  }

  if (!isValidEmail(email)) {
    return next(new ApiError(400, "Please provide a valid email address."));
  }

  if (!password) {
    return next(new ApiError(400, "Password is required."));
  }

  next();
};

export const validateBook = (req, res, next) => {
  const { title, author, isbn, publishedYear, genre, availableCopies, totalCopies } = req.body;
  const isPost = req.method === "POST";

  if (isPost) {
    if (!title || typeof title !== "string" || title.trim() === "") {
      return next(new ApiError(400, "Title is required."));
    }
    if (!author || typeof author !== "string" || author.trim() === "") {
      return next(new ApiError(400, "Author is required."));
    }
    if (!isbn || typeof isbn !== "string" || isbn.trim() === "") {
      return next(new ApiError(400, "ISBN is required."));
    }
    if (publishedYear === undefined || publishedYear === null) {
      return next(new ApiError(400, "Published year is required."));
    }
    if (!genre || typeof genre !== "string" || genre.trim() === "") {
      return next(new ApiError(400, "Genre is required."));
    }
    if (availableCopies === undefined || availableCopies === null) {
      return next(new ApiError(400, "Available copies is required."));
    }
    if (totalCopies === undefined || totalCopies === null) {
      return next(new ApiError(400, "Total copies is required."));
    }
  }

  if (publishedYear !== undefined && (isNaN(Number(publishedYear)) || Number(publishedYear) < 0)) {
    return next(new ApiError(400, "Published year must be a valid positive number."));
  }

  if (availableCopies !== undefined && (isNaN(Number(availableCopies)) || Number(availableCopies) < 0)) {
    return next(new ApiError(400, "Available copies cannot be negative."));
  }

  if (totalCopies !== undefined && (isNaN(Number(totalCopies)) || Number(totalCopies) < 0)) {
    return next(new ApiError(400, "Total copies cannot be negative."));
  }

  const avail = availableCopies !== undefined ? Number(availableCopies) : null;
  const tot = totalCopies !== undefined ? Number(totalCopies) : null;
  
  if (avail !== null && tot !== null && avail > tot) {
    return next(new ApiError(400, "Available copies cannot be greater than total copies."));
  }

  next();
};

export const validateBulkBooks = (req, res, next) => {
  if (!Array.isArray(req.body)) {
    return next(new ApiError(400, "Request body must be an array of books."));
  }
  if (req.body.length === 0) {
    return next(new ApiError(400, "Request body cannot be an empty array."));
  }

  const isbns = [];

  for (let i = 0; i < req.body.length; i++) {
    const book = req.body[i];
    const { title, author, isbn, publishedYear, genre, availableCopies, totalCopies } = book;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return next(new ApiError(400, `Book at index ${i}: Title is required.`));
    }
    if (!author || typeof author !== "string" || author.trim() === "") {
      return next(new ApiError(400, `Book at index ${i}: Author is required.`));
    }
    if (!isbn || typeof isbn !== "string" || isbn.trim() === "") {
      return next(new ApiError(400, `Book at index ${i}: ISBN is required.`));
    }
    if (publishedYear === undefined || publishedYear === null) {
      return next(new ApiError(400, `Book at index ${i}: Published year is required.`));
    }
    if (publishedYear !== undefined && (isNaN(Number(publishedYear)) || Number(publishedYear) < 0)) {
      return next(new ApiError(400, `Book at index ${i}: Published year must be a valid positive number.`));
    }
    if (!genre || typeof genre !== "string" || genre.trim() === "") {
      return next(new ApiError(400, `Book at index ${i}: Genre is required.`));
    }
    if (availableCopies === undefined || availableCopies === null) {
      return next(new ApiError(400, `Book at index ${i}: Available copies is required.`));
    }
    if (availableCopies !== undefined && (isNaN(Number(availableCopies)) || Number(availableCopies) < 0)) {
      return next(new ApiError(400, `Book at index ${i}: Available copies cannot be negative.`));
    }
    if (totalCopies === undefined || totalCopies === null) {
      return next(new ApiError(400, `Book at index ${i}: Total copies is required.`));
    }
    if (totalCopies !== undefined && (isNaN(Number(totalCopies)) || Number(totalCopies) < 0)) {
      return next(new ApiError(400, `Book at index ${i}: Total copies cannot be negative.`));
    }

    const avail = Number(availableCopies);
    const tot = Number(totalCopies);
    if (avail > tot) {
      return next(new ApiError(400, `Book at index ${i}: Available copies cannot be greater than total copies.`));
    }

    isbns.push(isbn);
  }

  const duplicateIsbns = isbns.filter((item, index) => isbns.indexOf(item) !== index);
  if (duplicateIsbns.length > 0) {
    return next(new ApiError(400, `Duplicate ISBNs found in the request: ${[...new Set(duplicateIsbns)].join(", ")}`));
  }

  next();
};


export const validateObjectId = (...paramNames) => {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName];
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return next(
          new ApiError(
            400,
            `Invalid ObjectId format for parameter '${paramName}'.`
          )
        );
      }
    }
    next();
  };
};

// ==========================================
// 5. REUSABLE QUERY BUILDER
// ==========================================

export class QueryBuilder {
  constructor(modelQuery, queryStr) {
    this.modelQuery = modelQuery;
    this.queryStr = queryStr;
  }

  search(fields = []) {
    if (this.queryStr.search && fields.length > 0) {
      const searchRegex = new RegExp(this.queryStr.search, "i");
      const orConditions = fields.map((field) => ({ [field]: searchRegex }));
      this.modelQuery = this.modelQuery.find({ $or: orConditions });
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.queryStr };
    const excludedFields = ["page", "sort", "limit", "fields", "search"];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.modelQuery = this.modelQuery.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split(",").join(" ");
      this.modelQuery = this.modelQuery.sort(sortBy);
    } else {
      this.modelQuery = this.modelQuery.sort("-createdAt");
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryStr.page, 10) || 1;
    const limit = parseInt(this.queryStr.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }
}