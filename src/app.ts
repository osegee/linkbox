import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import errorHandler from "./middleware/errorHandler";
import AppError from "./utils/appError";
import authRoutes from "./routes/auth.routes";
import collectionRoutes from "./routes/collection.routes";
import { env } from "./config/env";

const app: Application = express();

app.use(cors({ credentials: true }));
app.use(helmet());
app.use(express.json());
env.NODE_ENV === "development"
  ? app.use(morgan("dev"))
  : app.use(morgan("combined"));

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/auth", authRoutes);
app.use("/api/collections", collectionRoutes);
app.use((req, res, next) => {
  next(new AppError(404, "Route not found"));
});

app.use(errorHandler);

export { app };
