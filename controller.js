import jwt from "jsonwebtoken";
import { User, Book, Borrow } from "./model.js";
import { ApiError, asyncHandler, QueryBuilder } from "./helpers.js";
import bcrypt from "bcrypt"

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "7d" }
  );

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push(refreshToken);
  await user.save();

  return { accessToken, refreshToken };
};

export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password,role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "A user with this email address already exists.");
  }

  const hashedPassword=await bcrypt.hash(password,10)
  await User.create({
    name,
    email,
    password:hashedPassword,
    role,
  });

  res.status(201).json({
    success: true,
    message: "Member registered successfully",
  });
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email");
  }

  const isMatch = await bcrypt.compare(password,user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid password.");
  }

  const { accessToken, refreshToken } = await generateTokens(user);

  res.status(200).json({
    success: true,
    token: accessToken,
    // refreshToken,
    // user: {
    //   id: user._id,
    //   name: user.name,
    //   email: user.email,
    //   role: user.role,
    // },
  });
});

export const refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required.");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw new ApiError(403, "Invalid refresh token.");
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      success: true,
      token: accessToken,
    });
  } catch (error) {
    throw new ApiError(403, "Invalid or expired refresh token.");
  }
});

export const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required to log out.");
  }

  await User.findOneAndUpdate(
    { refreshTokens: refreshToken },
    { $pull: { refreshTokens: refreshToken } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});


// ==========================================
// 2. MEMBER MANAGEMENT CONTROLLERS
// ==========================================

export const getAllMembers = asyncHandler(async (req, res, next) => {
  const members = await User.find({ role: "member" }).select("-refreshTokens");
  res.status(200).json({
    success: true,
    results: members.length,
    data: members,
  });
});

export const deleteMember = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "Member not found.");
  }

  if (user.role === "librarian") {
    throw new ApiError(403, "Cannot delete user with 'librarian' role via this endpoint.");
  }

  await User.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Member deleted successfully",
  });
});


// ==========================================
// 3. BOOK CONTROLLERS
// ==========================================

export const createBook = asyncHandler(async (req, res, next) => {
  const { title, author, isbn, publishedYear, genre, availableCopies, totalCopies } = req.body;

  const existingBook = await Book.findOne({ isbn });
  if (existingBook) {
    throw new ApiError(409, `A book with ISBN '${isbn}' already exists.`);
  }

  const book = await Book.create({
    title,
    author,
    isbn,
    publishedYear,
    genre,
    availableCopies,
    totalCopies,
  });

  res.status(201).json({
    success: true,
    data: book,
  });
});

export const createBulkBooks = asyncHandler(async (req, res, next) => {
  const booksData = req.body;
  
  const isbns = booksData.map((b) => b.isbn);
  const existingBooks = await Book.find({ isbn: { $in: isbns } });

  if (existingBooks.length > 0) {
    const existingIsbns = existingBooks.map((b) => b.isbn);
    throw new ApiError(
      409,
      `Books with these ISBNs already exist: ${existingIsbns.join(", ")}`
    );
  }

  const books = await Book.insertMany(booksData);

  res.status(201).json({
    success: true,
    count: books.length,
    data: books,
  });
});

export const updateBook = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  let book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, "Book not found.");
  }

  book = await Book.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: book,
  });
});

export const deleteBook = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, "Book not found.");
  }

  const activeBorrows = await Borrow.countDocuments({ book: id, status: "borrowed" });
  if (activeBorrows > 0) {
    throw new ApiError(400, "Cannot delete book. There are active borrows for this book.");
  }

  await Book.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Book deleted successfully",
  });
});

export const getAllBooks = asyncHandler(async (req, res, next) => {
  const features = new QueryBuilder(Book.find(), req.query)
    .search(["title", "author"])
    .filter();

  const total = await Book.countDocuments(features.modelQuery.getFilter());

  features.sort().paginate();
  const books = await features.modelQuery;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    count: books.length,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
    data: books,
  });
});

export const getBookById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, "Book not found.");
  }

  res.status(200).json({
    success: true,
    data: book,
  });
});


// ==========================================
// 4. BORROW & RETURN CONTROLLERS
// ==========================================

export const getAvailableBooks = asyncHandler(async (req, res, next) => {
  const queryParams = { ...req.query, availableCopies: { gte: 1 } };
  
  const features = new QueryBuilder(Book.find(), queryParams)
    .search(["title", "author"])
    .filter();

  const total = await Book.countDocuments(features.modelQuery.getFilter());

  features.sort().paginate();
  const books = await features.modelQuery;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    count: books.length,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
    data: books,
  });
});

export const borrowBook = asyncHandler(async (req, res, next) => {
  const { bookId } = req.params;
  const userId = req.user.id;
  const borrowId = `${userId}._.${bookId}`;

  const activeBorrow = await Borrow.findOne({ _id: borrowId, status: "borrowed" });
  if (activeBorrow) {
    throw new ApiError(400, "You cannot borrow the same book twice simultaneously. Return the current copy first.");
  }

  const book = await Book.findOneAndUpdate(
    { _id: bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );

  if (!book) {
    const bookExists = await Book.findById(bookId);
    if (!bookExists) {
      throw new ApiError(404, "Book not found.");
    }
    throw new ApiError(400, "Book is currently out of stock / no copies available.");
  }

  let borrow = await Borrow.findById(borrowId);
  if (borrow) {
    borrow.status = "borrowed";
    borrow.borrowedAt = new Date();
    borrow.returnedAt = undefined;
    await borrow.save();
  } else {
    borrow = await Borrow.create({
      _id: borrowId,
      user: userId,
      book: bookId,
      status: "borrowed",
    });
  }

  res.status(200).json({
    success: true,
    message: "Book borrowed successfully",
    data: borrow,
  });
});

export const returnBook = asyncHandler(async (req, res, next) => {
  const { bookId } = req.params;
  const userId = req.user.id;
  const borrowId = `${userId}._.${bookId}`;

  const borrow = await Borrow.findOne({ _id: borrowId, status: "borrowed" });
  if (!borrow) {
    throw new ApiError(400, "Member can only return books they have borrowed and not yet returned.");
  }

  borrow.status = "returned";
  borrow.returnedAt = new Date();
  await borrow.save();

  await Book.findByIdAndUpdate(bookId, {
    $inc: { availableCopies: 1 },
  });

  res.status(200).json({
    success: true,
    message: "Book returned successfully",
  });
});

export const getMyBooks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const activeBorrows = await Borrow.find({ user: userId, status: "borrowed" })
    .populate("book")
    .sort("-borrowedAt");

  res.status(200).json({
    success: true,
    count: activeBorrows.length,
    data: activeBorrows,
  });
});