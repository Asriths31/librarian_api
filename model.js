import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

export const userSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    select: false,
  },
  role: {
    type: String,
    required: true,
    enum: ["member", "librarian"],
    default: "member",
  },
  refreshTokens: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
});

export const User= mongoose.model("users", userSchema);

export const bookSchema = new Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  author: {
    type: String,
    required: [true, "Author is required"],
    trim: true,
  },
  isbn: {
    type: String,
    required: [true, "ISBN is required"],
    unique: true,
    trim: true,
  },
  publishedYear: {
    type: Number,
    required: [true, "Published year is required"],
  },
  genre: {
    type: String,
    required: [true, "Genre is required"],
    trim: true,
  },
  availableCopies: {
    type: Number,
    required: [true, "Available copies is required"],
    min: [0, "Available copies cannot be negative"],
  },
  totalCopies: {
    type: Number,
    required: [true, "Total copies is required"],
    min: [0, "Total copies cannot be negative"],
  },
}, {
  timestamps: true,
});

export const Book = mongoose.model("books", bookSchema);

export const borrowSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: [true, "User is required"],
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "books",
    required: [true, "Book is required"],
  },
  borrowedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  returnedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["borrowed", "returned"],
    default: "borrowed",
    required: true,
  },
}, {
  timestamps: true,
  _id: false,
});

export const Borrow = mongoose.model("borrows", borrowSchema);
