import { Router } from "express";
import multer from "multer";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { adminUploadRateLimiter } from "../../middlewares/rateLimiters";
import { AppError } from "../../utils/AppError";
import {
  deleteProductImage,
  getProductImage,
  postProductImage,
} from "./upload.controller";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new AppError("Format non accepté. Utilise une image JPG, PNG ou WebP.", 415));
      return;
    }

    callback(null, true);
  },
});

const uploadRouter = Router();
const adminUploadRouter = Router();

uploadRouter.get("/:id", getProductImage);

adminUploadRouter.use(authenticateAdmin);
adminUploadRouter.post(
  "/",
  adminUploadRateLimiter,
  imageUpload.single("image"),
  postProductImage,
);
adminUploadRouter.delete("/:id", deleteProductImage);

export { adminUploadRouter, uploadRouter };
