# Library Management System Backend

This is a production-ready, consolidated Express.js backend for a Library Management System. It uses MongoDB (via Mongoose), JWT authentication, role-based authorization, request-body validation, and advanced search/filtering/sorting/pagination capabilities.

## Technology Stack

* **Node.js** with ES Modules (`"type": "module"`)
* **Express.js** (Server & Routing)
* **MongoDB & Mongoose** (Database Modeling & Connections)
* **JWT (JSON Web Tokens)** (Session-less Authentication)
* **bcrypt** (Password Hashing)
* **dotenv** (Environment Configuration)

---

## Directory Structure

```text
backenddd/
├── index.js                     # Server initialization & DB connection startup
├── routes.js                    # Subrouters & all endpoint routing paths
├── controller.js                # Controller actions for auth, members, and books
├── model.js                     # User, Book, and Borrow Mongoose schemas & models
├── helpers.js                   # Validations, error handlers, query utilities & middlewares
├── .env                         # Database and JWT secrets configuration
├── package.json                 # Dependencies and dev start scripts
├── api_routes_map.md            # Markdown reference mapping endpoints to actions
└── sample_requests.json         # Postman collection JSON
```

---

## How to Set Up and Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment variables (`.env`)**:
   Verify or configure variables inside the `.env` file at the root:
   ```env
   MONGO_URI=mongodb+srv://asrithsai:ASrith123@cluster0.sazwe.mongodb.net/librarySuperApp?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET_KEY=itisverysecretsuperapp%%%12345678
   PORT=2000
   ```

3. **Start in Development Mode** (using nodemon):
   ```bash
   npm run dev
   ```

---

## Database Models

### 1. User
* `name`: String, required.
* `email`: String, required, unique, validated format.
* `password`: String, required, min length 8, hashed via bcrypt, excluded by default (`select: false`).
* `role`: String, enum `["member", "librarian"]`, default `"member"`.

### 2. Book
* `title`: String, required.
* `author`: String, required.
* `isbn`: String, required, unique.
* `publishedYear`: Number, required, positive.
* `genre`: String, required.
* `availableCopies`: Number, required, cannot be negative.
* `totalCopies`: Number, required, cannot be negative.

### 3. Borrow
* `_id`: String, formatted as `userId_bookId` (composite string).
* `user`: ObjectId pointing to `User`, required.
* `book`: ObjectId pointing to `Book`, required.
* `borrowedAt`: Date, default `Date.now`.
* `returnedAt`: Date, set upon returning.
* `status`: String, enum `["borrowed", "returned"]`, default `"borrowed"`.

#### Design Highlight: Composite String ID
Using `userId_bookId` as the Borrow primary key enforces the rule: **"A user cannot borrow the same book twice simultaneously without returning it."**
1. When borrowing, we check if an active Borrow record with `_id = userId_bookId` exists with `status: "borrowed"`. If yes, the borrow request is rejected.
2. If it is returned, the status updates to `returned`.
3. If they borrow the book again later, we safely update/reactivate this same record, setting its status back to `borrowed` and resetting timestamps. This maintains a clean state database.

---

## Adding a Librarian

Librarians **cannot** register via the public API POST `/api/auth/register` (which explicitly forces `role: "member"`).
To seed a librarian, you can manually insert them into MongoDB using MongoDB Compass, Mongo Shell, or a script.

Example document for MongoDB insertion:
```json
{
  "name": "Jane Librarian",
  "email": "librarian@example.com",
  "password": "12345678",
  "role": "librarian",
  "refreshTokens": []
}
```
---

## Advanced Query Features

All book list endpoints (`GET /api/books` and `GET /api/books/available`) support:
1. **Search**: Search by title and author using `?search=Gatsby` (case-insensitive regex).
2. **Filtering**: Filter by properties like genre: `?genre=Fiction`.
3. **Sorting**: Sort by fields using `?sort=publishedYear` (ascending) or `?sort=-createdAt` (descending).
4. **Pagination**: Fetch subsets of documents using `?page=2&limit=5`. Returns a `pagination` block:
   ```json
   "pagination": {
     "total": 12,
     "page": 2,
     "limit": 5,
     "totalPages": 3
   }
   ```

---

## API Endpoints List

### Authentication
* `POST /api/auth/register` - Register a member.
* `POST /api/auth/login` - Log in. Returns `token` (access token) and `refreshToken`.
* `POST /api/auth/refresh` - Refresh an expired access token using a valid `refreshToken`.
* `POST /api/auth/logout` - Log out and invalidate the `refreshToken`.

### Books (Shared / Protected)
* `GET /api/books` - Retrieve all books (supports search/filter/pagination/sorting).
* `GET /api/books/available` - Retrieve books with `availableCopies > 0` (Member only).
* `GET /api/books/:id` - Retrieve details of a single book.

### Books (Librarian Only)
* `POST /api/books` - Create a book (ISBN unique check).
* `PUT /api/books/:id` - Update book details.
* `DELETE /api/books/:id` - Delete a book (blocked if there are active borrows for it).

### Borrowing (Member Only)
* `POST /api/books/:bookId/borrow` - Borrow a book (decrements available copies atomically).
* `POST /api/books/:bookId/return` - Return a book (increments available copies atomically).
* `GET /api/my-books` - View logged-in member's currently borrowed books.

### Members (Librarian Only)
* `GET /api/members` - Get list of all registered members.
* `DELETE /api/members/:id` - Delete a member (cannot delete librarians).

---

## Importing Postman Collection

Import `sample_requests.json` directly into Postman:
1. Click **Import** inside Postman.
2. Select the `sample_requests.json` file.
3. Configure the Collection Variables (under collection setting variables):
   * `baseUrl`: `http://localhost:2000/api`
   * `token` and `refreshToken` will be automatically saved into your environment variables when you call **Login User** or **Refresh Token**.
