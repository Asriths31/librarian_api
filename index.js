import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { configDotenv } from "dotenv";
import { routes } from "./routes.js";
import { errorMiddleware } from "./helpers.js";
import { Book } from "./model.js";

configDotenv();

const app = express();

app.use(express.json());
app.use(cors());

app.use("/health", (req, res) => {
  res.status(200).json("Api Is Running Succesfull");
});

app.use("/api", routes);

app.use(errorMiddleware);

const PORT = process.env.PORT || 2000;
const MONGO_URI = process.env.MONGO_URI;



if (!MONGO_URI) {
  console.error("MONGO_URI environment variable is missing.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });


  