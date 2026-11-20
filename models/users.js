const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  firstname: String,
  username: String,
  password: String,
  token: String,
  // Chemin de l'avatar dans le dossier public du frontend
  // (null pour les anciens comptes : le front affiche alors une silhouette)
  avatar: { type: String, default: null },
});

const User = mongoose.model("users", userSchema);

module.exports = User;
