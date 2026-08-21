import { Schema, model } from "mongoose";

const contactRequestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "processed"],
      default: "new",
    },
  },
  {
    timestamps: true,
  },
);

export const ContactRequestModel = model("ContactRequest", contactRequestSchema);
