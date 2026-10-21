import { Router } from "express";
import {
  createTagController,
  getTagsController,
  updateTagController,
  deleteTagController,
  attachTagsToLinkController,
  detachTagFromLinkController,
} from "../controllers/tag.controller";
import { protect } from "../middleware/auth.guard";
import { validate } from "../middleware/validate";
import {
  createTagSchema,
  updateTagSchema,
  attachTagsSchema,
} from "../schemas/tag.schema";

const router = Router();


router.use(protect);


router.post("/", validate(createTagSchema), createTagController);
router.get("/", getTagsController);
router.patch("/:id", validate(updateTagSchema), updateTagController);
router.delete("/:id", deleteTagController);


router.post(
  "/links/:linkId",
  validate(attachTagsSchema),
  attachTagsToLinkController,
);
router.delete("/links/:linkId/:tagId", detachTagFromLinkController);

export default router;