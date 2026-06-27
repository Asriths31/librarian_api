import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  getAllMembers,
  deleteMember,
  createBook,
  createBulkBooks,
  updateBook,
  deleteBook,
  getAllBooks,
  getBookById,
  getAvailableBooks,
  borrowBook,
  returnBook,
  getMyBooks,
} from "./controller.js";
import {
  authMiddleware,
  authorize,
  validateRegister,
  validateLogin,
  validateBook,
  validateBulkBooks,
  validateObjectId,
} from "./helpers.js";

export const routes = Router();


const authRouter = Router();
authRouter.post("/register", validateRegister, register);
authRouter.post("/login", validateLogin, login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
routes.use("/auth", authRouter);


const memberRouter = Router();
memberRouter.use(authMiddleware, authorize("librarian"));
memberRouter.get("/", getAllMembers);
memberRouter.delete("/:id", validateObjectId("id"), deleteMember);
routes.use("/members", memberRouter);


const bookRouter = Router();
bookRouter.use(authMiddleware);


bookRouter.get("/available", authorize("member"), getAvailableBooks);
bookRouter.post("/:bookId/borrow", authorize("member"), validateObjectId("bookId"), borrowBook);
bookRouter.post("/:bookId/return", authorize("member"), validateObjectId("bookId"), returnBook);

bookRouter.get("/", getAllBooks);
bookRouter.get("/:id", validateObjectId("id"), getBookById);

bookRouter.post("/bulk",createBulkBooks);
bookRouter.post("/", authorize("librarian"), validateBook, createBook);
bookRouter.put("/:id", authorize("librarian"), validateObjectId("id"), validateBook, updateBook);
bookRouter.delete("/:id", authorize("librarian"), validateObjectId("id"), deleteBook);

routes.use("/books", bookRouter);


routes.get("/my-books", authMiddleware, authorize("member"), getMyBooks);
