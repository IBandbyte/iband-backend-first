const mongoose = require("mongoose");

const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, required: true },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    votes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Artist", artistSchema);