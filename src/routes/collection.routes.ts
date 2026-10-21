import { Router } from "express";
import {
  createCollectionController,
  getCollectionByIdController,
  getCollectionController,
  deleteCollectionController,
  updateCollectionController,
} from "../controllers/collection.controller";
import { validate } from "../middleware/validate";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "../schemas/collection.schema";
import { protect } from "../middleware/auth.guard";
const router = Router();

router.use(protect);

router.post("/", validate(createCollectionSchema), createCollectionController);
router.get("/", getCollectionController);

router.get("/:id", getCollectionByIdController);
router.patch(
  "/:id",
  validate(updateCollectionSchema),
  updateCollectionController,
);
router.delete("/:id", deleteCollectionController);

export default router;
