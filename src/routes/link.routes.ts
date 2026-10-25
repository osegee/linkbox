import { Router } from "express";
import {
  createLinkController,
  getLinksController,
  getLinkByIdController,
  updateLinkController,
  deleteLinkController,
} from "../controllers/link.controller";
import { protect } from "../middleware/auth.guard";
import { validate } from "../middleware/validate";
import { createLinkSchema, updateLinkSchema } from "../schemas/link.schema";

const router = Router();

router.use(protect);

router.post("/", validate(createLinkSchema), createLinkController);
router.get("/", getLinksController);

router.get("/:id", getLinkByIdController);
router.patch("/:id", validate(updateLinkSchema), updateLinkController);
router.delete("/:id", deleteLinkController);

export default router;