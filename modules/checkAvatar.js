// Vérifie qu'un avatar est bien une image du dossier public/avatar du frontend,
// par exemple "/avatar/avatar-miami.webp".
// On refuse tout le reste (URL externe, "../", etc.) : un utilisateur ne peut
// pas enregistrer n'importe quelle adresse comme avatar.
const AVATAR_PATTERN = /^\/avatar\/[a-z0-9-]+\.(webp|png|jpe?g)$/;

function checkAvatar(avatar) {
  return typeof avatar === "string" && AVATAR_PATTERN.test(avatar);
}

module.exports = { checkAvatar };
