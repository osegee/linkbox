import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import errorHandler from "./middleware/errorHandler";
import AppError from "./utils/appError";

const app: Application = express();

app.use(cors({ credentials: true }));
app.use(helmet());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use((req, res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

export { app };
