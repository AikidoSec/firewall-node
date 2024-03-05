
import mongoose from "mongoose";

const GuestbookSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
  },
});

const Guestbook = mongoose.models.Guestbook || mongoose.model("Guestbook", GuestbookSchema);

export default Guestbook;