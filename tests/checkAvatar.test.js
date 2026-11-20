const { checkAvatar } = require('../modules/checkAvatar');

describe('checkAvatar', () => {
  it('accepte une image du dossier avatar', () => {
    expect(checkAvatar('/avatar/avatar-miami.webp')).toBe(true);
    expect(checkAvatar('/avatar/avatar-parisian.png')).toBe(true);
    expect(checkAvatar('/avatar/mon-avatar-2.jpg')).toBe(true);
  });

  it('refuse une URL externe', () => {
    expect(checkAvatar('https://site-pirate.com/avatar/x.webp')).toBe(false);
  });

  it('refuse une tentative de remonter dans les dossiers', () => {
    expect(checkAvatar('/avatar/../secret.webp')).toBe(false);
  });

  it("refuse un fichier qui n'est pas une image", () => {
    expect(checkAvatar('/avatar/script.js')).toBe(false);
  });

  it("refuse une valeur qui n'est pas du texte", () => {
    expect(checkAvatar(undefined)).toBe(false);
    expect(checkAvatar(null)).toBe(false);
    expect(checkAvatar(42)).toBe(false);
  });
});
